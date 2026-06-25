export class N8nSuccessDto {
  /**
   * job-xxx từ NestJS khi trigger.
   * Nếu gửi nhầm wf-xxx vào đây, BE coi là workflowId.
   */
  jobId?: string | number;
  /** wf-xxx — dùng khi không có jobId */
  workflowId?: string | number;
  /** Kết quả từ n8n (rows added, post ids, ...) */
  data?: Record<string, unknown>;
}
