import type {
  GenerateContentPostConfig,
  GenerateIdeaPostsConfig,
  GoogleOAuthConfig,
  WorkflowWebhookConfig,
} from '../data';

export class GoogleOAuthConfigDto implements GoogleOAuthConfig {
  /** UserCredential.id (type: google-oauth) */
  credentialId: string;
}

/** Patch chung — service merge theo workflow.type */
export class UpdateWorkflowConfigDto
  implements Partial<WorkflowWebhookConfig>
{
  topic?: string;
  useProductionWebhook?: boolean;
  webhookTestUrl?: string;
  webhookProductionUrl?: string;

  /** Ref → UserCredential.id (google-oauth) */
  googleOAuth?: GoogleOAuthConfigDto;

  /** Ref → UserCredential.id (api-key) — chỉ idea-posts */
  apiKeyCredentialId?: string;

  /** Ref → UserCredential.id (wordpress) — chỉ content-post */
  wordpressCredentialId?: string;
}

export type UpdateIdeaPostsConfigDto = Partial<GenerateIdeaPostsConfig>;
export type UpdateContentPostConfigDto = Partial<GenerateContentPostConfig>;
