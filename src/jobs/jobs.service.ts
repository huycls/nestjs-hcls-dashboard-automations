import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AutomationsService } from '../automations/automations.service';
import { N8nService } from '../automations/n8n.service';
import type { N8nJobContext } from '../automations/n8n.types';
import { AutomationJobEntity } from './entities/automation-job.entity';
import type { N8nCallbackDto } from './dto/n8n-callback.dto';
import type { RunJobDto } from './dto/run-job.dto';
import {
  AUTOMATION_QUEUE,
  type AutomationJobPayload,
  type JobStatus,
} from './jobs.constants';
import { JobsGateway, type JobStatusEvent } from './jobs.gateway';
import { isQueueEnabled } from '../config/env';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(AutomationJobEntity)
    private readonly jobRepo: Repository<AutomationJobEntity>,
    @Optional()
    @InjectQueue(AUTOMATION_QUEUE)
    private readonly automationQueue: Queue<AutomationJobPayload> | undefined,
    private readonly automationsService: AutomationsService,
    private readonly n8nService: N8nService,
    private readonly jobsGateway: JobsGateway,
  ) {}

  async run(dto: RunJobDto) {
    const topic = dto.topic?.trim();
    const workflowId = dto.workflowId?.trim();

    if (!workflowId) {
      throw new BadRequestException('workflowId is required');
    }

    if (!topic) {
      throw new BadRequestException('topic is required');
    }

    const context = await this.automationsService.resolveForTrigger(
      workflowId,
      topic,
    );
    const job = await this.createJob(
      context.siteId,
      context.workflowId,
      topic,
    );

    if (this.isQueueEnabled()) {
      if (!this.automationQueue) {
        throw new BadRequestException('Queue is enabled but BullMQ is not configured');
      }

      await this.automationQueue.add(
        'run',
        { jobId: job.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );

      return this.toPublicJob(job);
    }

    await this.dispatch(job.id);
    const updated = await this.findEntity(job.id);

    if (updated.status === 'failed') {
      throw new BadGatewayException({
        message: updated.errorMessage ?? 'n8n webhook failed',
        job: this.toPublicJob(updated),
      });
    }

    return this.toPublicJob(updated);
  }

  async dispatch(jobId: string): Promise<void> {
    const job = await this.findEntity(jobId);
    const context = await this.automationsService.resolveForTrigger(
      job.workflowId,
      job.topic,
    );

    await this.updateStatus(job, 'processing');

    const n8nContext: N8nJobContext = {
      ...context,
      jobId: job.id,
      callbackUrl: this.buildCallbackUrl(),
    };

    const result = await this.n8nService.triggerJob(n8nContext);

    job.n8nResponse = {
      ok: result.ok,
      status: result.status,
      message: result.message,
      webhookUrl: result.webhookUrl,
    };

    if (!result.ok) {
      job.errorMessage = result.message;
      await this.updateStatus(job, 'failed');
      return;
    }

    await this.automationsService.incrementTriggers(job.workflowId);
    await this.jobRepo.save(job);
    this.emit(job);
    this.logger.log(`n8n triggered for job ${job.id} → ${result.webhookUrl}`);
  }

  async handleCallback(dto: N8nCallbackDto, secret?: string) {
    this.validateCallbackSecret(secret);

    const job = await this.findEntity(dto.jobId);
    job.callbackPayload = dto.data ?? null;

    if (dto.status === 'completed') {
      job.errorMessage = null;
      await this.updateStatus(job, 'completed');
      await this.automationsService.incrementTriggers(job.workflowId);
      return this.toPublicJob(job);
    }

    job.errorMessage = dto.error ?? 'n8n workflow reported failure';
    await this.updateStatus(job, 'failed');
    return this.toPublicJob(job);
  }

  async findOne(id: string) {
    const job = await this.findEntity(id);
    return this.toPublicJob(job);
  }

  private async createJob(
    siteId: string | null,
    workflowId: string,
    topic: string,
  ) {
    const job = this.jobRepo.create({
      id: `job-${randomUUID()}`,
      siteId,
      workflowId,
      topic,
      status: 'queued',
      n8nResponse: null,
      callbackPayload: null,
      errorMessage: null,
      completedAt: null,
    });

    const saved = await this.jobRepo.save(job);
    this.emit(saved);
    return saved;
  }

  private async updateStatus(job: AutomationJobEntity, status: JobStatus) {
    job.status = status;

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    await this.jobRepo.save(job);
    this.emit(job);
  }

  private emit(job: AutomationJobEntity) {
    this.jobsGateway.emitJobStatus(this.toPublicJob(job));
  }

  private toPublicJob(job: AutomationJobEntity): JobStatusEvent {
    const n8n = job.n8nResponse as JobStatusEvent['n8n'];

    return {
      id: job.id,
      siteId: job.siteId,
      workflowId: job.workflowId,
      topic: job.topic,
      status: job.status,
      errorMessage: job.errorMessage,
      n8n: n8n ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  private async findEntity(id: string) {
    const job = await this.jobRepo.findOne({ where: { id } });

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    return job;
  }

  private isQueueEnabled() {
    return isQueueEnabled();
  }

  private buildCallbackUrl() {
    const base = (
      process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 5000}`
    ).replace(/\/$/, '');

    return `${base}/api/jobs/callback`;
  }

  private validateCallbackSecret(secret?: string) {
    const expected = process.env.N8N_CALLBACK_SECRET;

    if (!expected) {
      return;
    }

    if (secret !== expected) {
      throw new UnauthorizedException('Invalid callback secret');
    }
  }
}
