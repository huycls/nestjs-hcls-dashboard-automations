export class RunJobDto {
  workflowId: string;
  /** Bắt buộc với generate-idea-posts; optional với generate-content-post */
  topic?: string;
}
