import type { WorkflowTriggerContext } from './workflow.mapper';

export type N8nJobContext = WorkflowTriggerContext & {
  jobId: string;
  callbackUrl: string;
  errorUrl: string;
  successUrl: string;
};

export type TriggerWebhookResult = {
  ok: boolean;
  status: number;
  message: string;
  workflowId?: string;
  jobId?: string;
  webhookUrl?: string;
};
