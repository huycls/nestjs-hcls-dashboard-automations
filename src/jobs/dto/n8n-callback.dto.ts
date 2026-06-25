export class N8nCallbackDto {
  jobId?: string | number;
  workflowId?: string | number;
  status: 'completed' | 'failed';
  data?: Record<string, unknown>;
  error?: string;
}
