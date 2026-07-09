import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { JobStatus } from '../jobs.constants';

export type AutomationJobDocument = HydratedDocument<AutomationJob>;

const JOB_STATUSES: JobStatus[] = [
  'queued',
  'processing',
  'completed',
  'failed',
];

@Schema({ timestamps: true, collection: 'automation_jobs' })
export class AutomationJob {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ type: String, default: null })
  siteId: string | null;

  @Prop({ required: true, index: true })
  workflowId: string;

  @Prop({ default: '' })
  topic: string;

  @Prop({ type: String, enum: JOB_STATUSES, default: 'queued' })
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
