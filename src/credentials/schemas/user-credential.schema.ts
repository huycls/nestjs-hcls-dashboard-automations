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
 * Kho credentials của user (User → Credentials → Jobs).
 *
 * - `ownerId` → users._id
 * - google-oauth / api-key → `n8nCredentialId` và/hoặc `data`
 * - wordpress → `data` { siteUrl, username?, appPassword? }
 * - api-key (OpenRouter, …) → `data.apiKey` và/hoặc `n8nCredentialId`
 */
@Schema({ timestamps: true, collection: 'user_credentials' })
export class UserCredential {
  @Prop({ required: true, unique: true })
  id: string;

  /** Link tới users — canonical owner field */
  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true, enum: CREDENTIAL_TYPES })
  type: CredentialType;

  @Prop({ required: true, trim: true })
  label: string;

  /** n8n credential id — google-oauth, api-key (khi đã sync n8n) */
  @Prop({ type: String, default: undefined })
  n8nCredentialId?: string;

  /**
   * Extra payload — secrets encrypted at rest (AES-256-GCM) via CryptoService:
   * - wordpress: siteUrl, username, appPassword (encrypted)
   * - api-key: apiKey (encrypted), provider?
   */
  @Prop({ type: Object, default: undefined })
  data?: Record<string, string>;

  createdAt: Date;
  updatedAt: Date;
}

export const UserCredentialSchema = SchemaFactory.createForClass(UserCredential);

UserCredentialSchema.index({ ownerId: 1, type: 1 });
UserCredentialSchema.index({ ownerId: 1, updatedAt: -1 });
