import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AutomationsModule } from './automations/automations.module';
import { WorkflowEntity } from './automations/entities/workflow.entity';
import { WorkflowNodeCredentialEntity } from './automations/entities/workflow-node-credential.entity';
import { isQueueEnabled } from './config/env';
import { AutomationJobEntity } from './jobs/entities/automation-job.entity';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: process.env.DATABASE_PATH ?? 'data/automations.sqlite',
      autoSave: true,
      entities: [
        WorkflowEntity,
        WorkflowNodeCredentialEntity,
        AutomationJobEntity,
      ],
      synchronize: true,
    }),
    ...(isQueueEnabled()
      ? [
          BullModule.forRoot({
            connection: {
              host: process.env.REDIS_HOST ?? 'localhost',
              port: Number(process.env.REDIS_PORT ?? 6379),
              password: process.env.REDIS_PASSWORD || undefined,
            },
          }),
        ]
      : []),
    AutomationsModule,
    JobsModule.register(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
