import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  GoogleOAuthConfig,
  GoogleOAuthConfigSchema,
} from './google-oauth-config.schema';
import { WorkflowWebhookFields } from './workflow-webhook-fields.schema';

/**
 * generate-content-post
 * — Google OAuth + WordPress credential ref (data nằm ở user_credentials)
 */
@Schema({ _id: false })
export class GenerateContentPostConfig extends WorkflowWebhookFields {
  @Prop({ type: GoogleOAuthConfigSchema, default: () => ({ credentialId: '' }) })
  googleOAuth: GoogleOAuthConfig;

  /** Ref → UserCredential.id (type: wordpress) */
  @Prop({ default: '' })
  wordpressCredentialId: string;
}

export const GenerateContentPostConfigSchema =
  SchemaFactory.createForClass(GenerateContentPostConfig);
