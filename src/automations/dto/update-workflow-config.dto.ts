import type { WorkflowConfig } from '../data';

export class UpdateWorkflowConfigDto implements Partial<WorkflowConfig> {
  topic?: string;
  useProductionWebhook?: boolean;
  webhookTestUrl?: string;
  webhookProductionUrl?: string;
}
