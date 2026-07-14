import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AutomationsModule } from '../automations/automations.module';
import { isQueueEnabled } from '../config/env';
import { AUTOMATION_QUEUE } from './jobs.constants';
import { JobsController } from './jobs.controller';
import { JobsGateway } from './jobs.gateway';
import { JobsProcessor } from './jobs.processor';
import { JobsService } from './jobs.service';
import { AutomationJob, AutomationJobSchema } from './schemas/automation-job.schema';

@Module({})
export class JobsModule {
  static register(): DynamicModule {
    const queueEnabled = isQueueEnabled();

    return {
      module: JobsModule,
      imports: [
        MongooseModule.forFeature([
          { name: AutomationJob.name, schema: AutomationJobSchema },
        ]),
        AuthModule,
        AutomationsModule,
        ...(queueEnabled
          ? [BullModule.registerQueue({ name: AUTOMATION_QUEUE })]
          : []),
      ],
      controllers: [JobsController],
      providers: [
        JobsService,
        JobsGateway,
        ...(queueEnabled ? [JobsProcessor] : []),
      ],
      exports: [JobsService],
    };
  }
}
