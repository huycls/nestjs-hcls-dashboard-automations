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
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import { AutomationsService } from '../automations/automations.service';
import type { WorkflowItem } from '../automations/data';
import { getConfigTopic, workflowRequiresTopic } from '../automations/data';
import { N8nService } from '../automations/n8n.service';
import type { N8nJobContext } from '../automations/n8n.types';
import {
  AutomationJob,
  AutomationJobDocument,
} from './schemas/automation-job.schema';
import type { N8nCallbackDto } from './dto/n8n-callback.dto';
import type { N8nErrorDto } from './dto/n8n-error.dto';
import type { N8nSuccessDto } from './dto/n8n-success.dto';
import type { RunJobDto } from './dto/run-job.dto';
import {
  AUTOMATION_QUEUE,
  type AutomationJobPayload,
  type JobStatus,
} from './jobs.constants';
import { JobsGateway, type JobStatusEvent } from './jobs.gateway';
import { isQueueEnabled } from '../config/env';

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** n8n hay gửi nhầm workflowId (wf-*) vào field jobId */
function resolveWorkflowIdFromPayload(
  rawJobId: string,
  rawWorkflowId: string,
): string {
  if (rawWorkflowId) return rawWorkflowId;
  if (rawJobId.startsWith('wf-')) return rawJobId;
  return '';
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectModel(AutomationJob.name)
    private readonly jobModel: Model<AutomationJobDocument>,
    @Optional()
    @InjectQueue(AUTOMATION_QUEUE)
    private readonly automationQueue: Queue<AutomationJobPayload> | undefined,
    private readonly automationsService: AutomationsService,
    private readonly n8nService: N8nService,
    private readonly jobsGateway: JobsGateway,
  ) {}

  async run(dto: RunJobDto) {
    const workflowId = dto.workflowId?.trim();

    if (!workflowId) {
      throw new BadRequestException('workflowId is required');
    }

    const workflow = await this.automationsService.findOne(workflowId);
    const topic =
      dto.topic?.trim() || getConfigTopic(workflow.config) || '';

    if (workflowRequiresTopic(workflow.type) && !topic) {
      throw new BadRequestException('topic is required');
    }

    const context = await this.automationsService.resolveForTrigger(
      workflowId,
      topic || undefined,
    );

    const runningWorkflow =
      await this.automationsService.markAsRunning(workflowId);

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

      return this.toRunResponse(job, runningWorkflow);
    }

    await this.dispatch(job.id);
    const updated = await this.findEntity(job.id);
    const currentWorkflow = await this.automationsService.findOne(workflowId);

    if (updated.status === 'failed') {
      const failedWorkflow = await this.automationsService.markRunFinished(
        workflowId,
        'failed',
      );

      throw new BadGatewayException({
        message: updated.errorMessage ?? 'n8n webhook failed',
        job: this.toPublicJob(updated),
        workflow: failedWorkflow,
      });
    }

    return this.toRunResponse(updated, currentWorkflow);
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
      errorUrl: this.buildErrorUrl(),
      successUrl: this.buildSuccessUrl(),
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
      await this.automationsService.markRunFinished(job.workflowId, 'failed');
      return;
    }

    await job.save();
    this.emit(job);
    this.logger.log(`n8n triggered for job ${job.id} → ${result.webhookUrl}`);
  }

  /** n8n báo workflow chạy thành công — tăng triggers + cập nhật status workflow */
  async handleSuccess(dto: N8nSuccessDto, secret?: string) {
    this.validateCallbackSecret(secret);

    const rawJobId = asTrimmedString(dto.jobId);
    const rawWorkflowId = asTrimmedString(dto.workflowId);
    const workflowId = resolveWorkflowIdFromPayload(rawJobId, rawWorkflowId);

    if (!rawJobId && !workflowId) {
      throw new BadRequestException('jobId or workflowId is required');
    }

    const job = await this.resolveJobForN8nReport(rawJobId, workflowId);

    if (!job) {
      if (!workflowId) {
        throw new NotFoundException(`Job ${rawJobId} not found`);
      }

      await this.automationsService.findOne(workflowId);
      await this.automationsService.incrementTriggers(workflowId);
      const workflow = await this.automationsService.markRunFinished(
        workflowId,
        'completed',
      );

      this.logger.log(
        `n8n success for workflow ${workflowId} (no job record), triggers=${workflow.triggers}`,
      );

      return {
        ok: true,
        job: null,
        workflow,
        warning: 'No job record found; workflow triggers incremented',
      };
    }

    if (job.status === 'completed') {
      const workflow = await this.automationsService.findOne(job.workflowId);
      return {
        ok: true,
        job: this.toPublicJob(job),
        workflow,
        warning: 'Job already completed',
      };
    }

    job.errorMessage = null;
    job.callbackPayload = {
      ...(dto.data ?? {}),
      source: 'n8n-success',
      workflowId: workflowId || job.workflowId,
      reportedAt: new Date().toISOString(),
    };

    await this.updateStatus(job, 'completed');
    await this.automationsService.incrementTriggers(job.workflowId);
    const workflow = await this.automationsService.markRunFinished(
      job.workflowId,
      'completed',
    );

    this.logger.log(
      `n8n success for job ${job.id} (workflow ${job.workflowId}), triggers=${workflow.triggers}`,
    );

    return { ok: true, job: this.toPublicJob(job), workflow };
  }

  async handleError(dto: N8nErrorDto, secret?: string) {
    this.validateCallbackSecret(secret);

    const rawJobId = asTrimmedString(dto.jobId);
    const rawWorkflowId = asTrimmedString(dto.workflowId);
    const workflowId = resolveWorkflowIdFromPayload(rawJobId, rawWorkflowId);

    if (!rawJobId && !workflowId) {
      throw new BadRequestException('jobId or workflowId is required');
    }

    const errorText =
      asTrimmedString(dto.error) ||
      asTrimmedString(dto.message) ||
      'n8n workflow error';

    const job = await this.resolveJobForN8nReport(rawJobId, workflowId);

    if (!job) {
      if (!workflowId) {
        throw new NotFoundException(`Job ${rawJobId} not found`);
      }

      await this.automationsService.findOne(workflowId);
      const workflow = await this.automationsService.markRunFinished(
        workflowId,
        'failed',
      );

      this.logger.warn(
        `n8n error for workflow ${workflowId} (no job record): ${errorText}`,
      );

      return {
        ok: true,
        job: null,
        workflow,
        warning: 'No job record found; workflow marked as failed',
      };
    }

    job.errorMessage = dto.node
      ? `[${dto.node}] ${errorText}`
      : errorText;

    job.callbackPayload = {
      ...(dto.data ?? {}),
      source: 'n8n-error',
      node: dto.node ?? null,
      workflowId: workflowId || job.workflowId,
      reportedAt: new Date().toISOString(),
    };

    await this.updateStatus(job, 'failed');
    const workflow = await this.automationsService.markRunFinished(
      job.workflowId,
      'failed',
    );

    this.logger.warn(
      `n8n error for job ${job.id} (workflow ${job.workflowId}): ${job.errorMessage}`,
    );

    return { ok: true, job: this.toPublicJob(job), workflow };
  }

  async handleCallback(dto: N8nCallbackDto, secret?: string) {
    this.validateCallbackSecret(secret);

    if (dto.status === 'completed') {
      return this.handleSuccess(
        {
          jobId: dto.jobId,
          workflowId: dto.workflowId,
          data: dto.data,
        },
        secret,
      );
    }

    const rawJobId = asTrimmedString(dto.jobId);
    const rawWorkflowId = asTrimmedString(dto.workflowId);
    const workflowId = resolveWorkflowIdFromPayload(rawJobId, rawWorkflowId);
    const job = await this.resolveJobForN8nReport(rawJobId, workflowId);

    if (!job) {
      if (!workflowId) {
        throw new NotFoundException(`Job ${rawJobId} not found`);
      }

      const workflow = await this.automationsService.markRunFinished(
        workflowId,
        'failed',
      );
      return { ok: true, job: null, workflow };
    }

    job.callbackPayload = dto.data ?? null;
    job.errorMessage = dto.error ?? 'n8n workflow reported failure';
    await this.updateStatus(job, 'failed');
    const workflow = await this.automationsService.markRunFinished(
      job.workflowId,
      'failed',
    );
    return { ok: true, job: this.toPublicJob(job), workflow };
  }

  async findAll(workflowId?: string) {
    const filter = workflowId?.trim() ? { workflowId: workflowId.trim() } : {};
    const jobs = await this.jobModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    return jobs.map((job) => this.toPublicJob(job));
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
    const saved = await this.jobModel.create({
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
    this.emit(saved);
    return saved;
  }

  private async updateStatus(job: AutomationJobDocument, status: JobStatus) {
    job.status = status;

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    await job.save();
    this.emit(job);
  }

  private emit(job: AutomationJobDocument) {
    this.jobsGateway.emitJobStatus(this.toPublicJob(job));
  }

  private toRunResponse(
    job: AutomationJobDocument,
    workflow: WorkflowItem,
  ) {
    return {
      job: this.toPublicJob(job),
      workflow,
    };
  }

  private toPublicJob(job: AutomationJobDocument): JobStatusEvent {
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
    const job = await this.jobModel.findOne({ id }).exec();

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

  private buildErrorUrl() {
    const base = (
      process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 5000}`
    ).replace(/\/$/, '');

    return `${base}/api/jobs/error`;
  }

  private buildSuccessUrl() {
    const base = (
      process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 5000}`
    ).replace(/\/$/, '');

    return `${base}/api/jobs/success`;
  }

  private async resolveJobForN8nReport(
    rawJobId: string,
    workflowId: string,
  ): Promise<AutomationJobDocument | null> {
    if (rawJobId.startsWith('job-')) {
      const job = await this.jobModel.findOne({ id: rawJobId }).exec();
      if (job) return job;
    }

    if (!workflowId) {
      return null;
    }

    const activeJob = await this.jobModel
      .findOne({
        workflowId,
        status: { $in: ['queued', 'processing'] },
      })
      .sort({ createdAt: -1 })
      .exec();

    if (activeJob) {
      return activeJob;
    }

    return this.jobModel
      .findOne({ workflowId })
      .sort({ createdAt: -1 })
      .exec();
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
