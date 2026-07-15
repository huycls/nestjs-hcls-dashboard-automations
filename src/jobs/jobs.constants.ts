export const AUTOMATION_QUEUE = 'automation-jobs';

export type JobStatus =
  | 'draft'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export type AutomationJobPayload = {
  jobId: string;
};
