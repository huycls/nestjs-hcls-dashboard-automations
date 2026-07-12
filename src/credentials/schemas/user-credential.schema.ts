import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const CREDENTIAL_TYPES = [
  'google-oauth',
  'api-key',
  'wordpress',
] as const;

export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export type UserCredentialDocument = HydratedDocument<UserCredential>;

/**
 * Credentials thuộc về user — workflow chỉ lưu ref (`credentialId` = `id`).
 *
 * - google-oauth / api-key → `n8nCredentialId`
 * - wordpress → `data` { siteUrl, username?, appPassword? }
 */
@Schema({ timestamps: true, collection: 'user_credentials' })
export class UserCredential {
  @Prop({ required: true, unique: true })
  id: string;

  /** JWT `sub` / User._id.toString() */
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: CREDENTIAL_TYPES })
  type: CredentialType;

  @Prop({ required: true, trim: true })
  label: string;

  /** n8n credential id — dùng cho google-oauth, api-key */
  @Prop({ type: String, default: undefined })
  n8nCredentialId?: string;

  /** Extra payload — wordpress: siteUrl, username, appPassword */
  @Prop({ type: Object, default: undefined })
  data?: Record<string, string>;

  createdAt: Date;
  updatedAt: Date;
}

export const UserCredentialSchema = SchemaFactory.createForClass(UserCredential);

UserCredentialSchema.index({ userId: 1, type: 1 });
UserCredentialSchema.index({ userId: 1, updatedAt: -1 });
