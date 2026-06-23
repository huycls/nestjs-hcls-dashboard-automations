import type { WorkflowType } from '../data';
import type { UpsertNodeCredentialDto } from './upsert-node-credential.dto';
import type { UpdateWorkflowConfigDto } from './update-workflow-config.dto';

export class CreateWorkflowDto {
  name: string;
  type: WorkflowType;
  siteId?: string;
  config?: UpdateWorkflowConfigDto;
  nodeCredentials?: UpsertNodeCredentialDto[];
}
