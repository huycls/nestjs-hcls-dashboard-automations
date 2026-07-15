import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { JobStatus } from '../jobs.constants';

export type AutomationJobDocument = HydratedDocument<AutomationJob>;

const JOB_STATUSES: JobStatus[] = [
  'draft',
  'queued',
  'processing',
  'completed',
  'failed',
];

/** Non-secret per-job settings (model, sheet id, …) */
@Schema({ _id: false })
export class JobSettings {
  @Prop({ default: '' })
  model: string;

  @Prop({ default: '' })
  spreadsheetId: string;
}

export const JobSettingsSchema = SchemaFactory.createForClass(JobSettings);

/**
 * Refs tới `user_credentials.id` — secrets nằm ở vault, không lưu trên job.
 */
@Schema({ _id: false })
export class JobCredentialRefs {
  /** UserCredential.id (type: api-key) — OpenRouter / Gemini key */
  @Prop({ type: String, default: undefined })
  apiKeyCredentialId?: string;

  /** UserCredential.id (type: google-oauth) */
  @Prop({ type: String, default: undefined })
  googleCredentialId?: string;

  /** UserCredential.id (type: wordpress) */
  @Prop({ type: String, default: undefined })
  wordpressCredentialId?: string;
}

export const JobCredentialRefsSchema =
  SchemaFactory.createForClass(JobCredentialRefs);

@Schema({ timestamps: true, collection: 'automation_jobs' })
export class AutomationJob {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ type: String, default: null })
  siteId: string | null;

  /** Owner — users._id */
  @Prop({ type: String, index: true, default: null })
  userId: string | null;

  /** Ref tới workflow type template trong collection `workflows` */
  @Prop({ required: true, index: true })
  workflowId: string;

  /** Tên automation do user đặt */
  @Prop({ default: '' })
  name: string;

  @Prop({ default: '' })
  topic: string;

  @Prop({
    type: JobSettingsSchema,
    default: () => ({ model: '', spreadsheetId: '' }),
  })
  settings: JobSettings;

  @Prop({
    type: JobCredentialRefsSchema,
    default: () => ({}),
  })
  credentialRefs: JobCredentialRefs;

  @Prop({ type: String, enum: JOB_STATUSES, default: 'draft' })
  status: JobStatus;

  @Prop({ type: Object, default: null })
  n8nResponse: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  callbackPayload: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  errorMessage: string | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const AutomationJobSchema = SchemaFactory.createForClass(AutomationJob);

AutomationJobSchema.index({ id: 1 }, { unique: true });
AutomationJobSchema.index({ workflowId: 1, status: 1, createdAt: -1 });
AutomationJobSchema.index({ userId: 1, createdAt: -1 });
AutomationJobSchema.index({ userId: 1, workflowId: 1, createdAt: -1 });
