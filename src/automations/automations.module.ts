import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { WorkflowEntity } from './entities/workflow.entity';
import { WorkflowNodeCredentialEntity } from './entities/workflow-node-credential.entity';
import { N8nController } from './n8n.controller';
import { N8nService } from './n8n.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowEntity, WorkflowNodeCredentialEntity]),
  ],
  controllers: [AutomationsController, N8nController],
  providers: [AutomationsService, N8nService],
  exports: [AutomationsService, N8nService],
})
export class AutomationsModule {}
