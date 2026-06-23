export class N8nCallbackDto {
  jobId: string;
  status: 'completed' | 'failed';
  data?: Record<string, unknown>;
  error?: string;
}
