/**
 * Barrel — re-export config schemas theo workflow type.
 * Thêm type mới: tạo file `*-config.schema.ts` rồi export tại đây.
 */
export {
  GoogleOAuthConfig,
  GoogleOAuthConfigSchema,
} from './google-oauth-config.schema';
export {
  WordpressConfig,
  WordpressConfigSchema,
} from './wordpress-config.schema';
export {
  WorkflowWebhookFields,
  WorkflowWebhookFieldsSchema,
} from './workflow-webhook-fields.schema';
export {
  GenerateIdeaPostsConfig,
  GenerateIdeaPostsConfigSchema,
} from './generate-idea-posts-config.schema';
export {
  GenerateContentPostConfig,
  GenerateContentPostConfigSchema,
} from './generate-content-post-config.schema';

import type { GenerateContentPostConfig } from './generate-content-post-config.schema';
import type { GenerateIdeaPostsConfig } from './generate-idea-posts-config.schema';

/** Union lưu trong Workflow.config — Mongoose dùng Mixed + validate theo type ở service */
export type WorkflowConfigDocument =
  | GenerateIdeaPostsConfig
  | GenerateContentPostConfig;
