export class N8nErrorDto {
  /**
   * job-xxx từ NestJS khi trigger.
   * Lưu ý: nếu gửi nhầm wf-xxx vào đây, BE sẽ coi là workflowId.
   */
  jobId?: string | number;
  error?: string;
  message?: string;
  node?: string;
  /** wf-xxx — dùng khi Error Workflow không có jobId */
  workflowId?: string | number;
  data?: Record<string, unknown>;
}
