import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AUTOMATION_QUEUE, type AutomationJobPayload } from './jobs.constants';
import { JobsService } from './jobs.service';

@Processor(AUTOMATION_QUEUE)
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(private readonly jobsService: JobsService) {
    super();
  }

  async process(job: Job<AutomationJobPayload>) {
    this.logger.log(`Processing automation job ${job.data.jobId}`);
    await this.jobsService.dispatch(job.data.jobId);
  }
}
