import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationsModule } from '../automations/automations.module';
import { isQueueEnabled } from '../config/env';
import { AutomationJobEntity } from './entities/automation-job.entity';
import { AUTOMATION_QUEUE } from './jobs.constants';
import { JobsController } from './jobs.controller';
import { JobsGateway } from './jobs.gateway';
import { JobsProcessor } from './jobs.processor';
import { JobsService } from './jobs.service';

@Module({})
export class JobsModule {
  static register(): DynamicModule {
    const queueEnabled = isQueueEnabled();

    return {
      module: JobsModule,
      imports: [
        TypeOrmModule.forFeature([AutomationJobEntity]),
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
