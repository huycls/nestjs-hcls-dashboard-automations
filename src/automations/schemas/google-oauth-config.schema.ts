import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Google OAuth — credential ref (secret nằm n8n / credential store) */
@Schema({ _id: false })
export class GoogleOAuthConfig {
  @Prop({ required: true, default: '' })
  credentialId: string;
}

export const GoogleOAuthConfigSchema =
  SchemaFactory.createForClass(GoogleOAuthConfig);
