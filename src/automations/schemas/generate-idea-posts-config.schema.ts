import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  GoogleOAuthConfig,
  GoogleOAuthConfigSchema,
} from './google-oauth-config.schema';
import { WorkflowWebhookFields } from './workflow-webhook-fields.schema';

/**
 * generate-idea-posts
 * — Google OAuth (Sheets) + API key credential ref + topic
 */
@Schema({ _id: false })
export class GenerateIdeaPostsConfig extends WorkflowWebhookFields {
  @Prop({ default: '' })
  topic: string;

  @Prop({ type: GoogleOAuthConfigSchema, default: () => ({ credentialId: '' }) })
  googleOAuth: GoogleOAuthConfig;

  @Prop({ default: '' })
  apiKeyCredentialId: string;
}

export const GenerateIdeaPostsConfigSchema =
  SchemaFactory.createForClass(GenerateIdeaPostsConfig);
