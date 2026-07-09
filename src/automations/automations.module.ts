import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AutomationJob,
  AutomationJobSchema,
} from '../jobs/schemas/automation-job.schema';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { N8nController } from './n8n.controller';
import { N8nService } from './n8n.service';
import { Workflow, WorkflowSchema } from './schemas/workflow.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workflow.name, schema: WorkflowSchema },
      { name: AutomationJob.name, schema: AutomationJobSchema },
    ]),
  ],
  controllers: [AutomationsController, N8nController],
  providers: [AutomationsService, N8nService],
  exports: [AutomationsService, N8nService],
})
export class AutomationsModule {}
