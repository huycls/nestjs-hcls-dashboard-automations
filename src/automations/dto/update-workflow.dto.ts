import type { WorkflowStatus } from '../data';

export class UpdateWorkflowDto {
  name?: string;
  status?: WorkflowStatus;
}
