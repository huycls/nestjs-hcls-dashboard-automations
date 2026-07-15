import type { WorkflowType } from '../../automations/data';

/** Tạo automation instance trong `automation_jobs` — không tạo workflow mới */
export class CreateJobDto {
  /** Workflow type template id (`wf-...`) */
  workflowId?: string;
  /** Hoặc chọn theo type — BE resolve template sẵn có */
  type?: WorkflowType;
  name?: string;
  topic?: string;
}
