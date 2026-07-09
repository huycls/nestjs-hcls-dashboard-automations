import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  NODE_TYPE_IDS,
  type NodeTypeId,
  type WorkflowStatus,
  type WorkflowType,
} from '../data';

export type WorkflowDocument = HydratedDocument<Workflow>;

@Schema({ _id: false })
export class WorkflowNodeCredential {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, enum: NODE_TYPE_IDS })
  nodeTypeId: NodeTypeId;

  @Prop({ required: true })
  credentialId: string;

  @Prop({ type: Object, default: undefined })
  config?: Record<string, string>;
}

export const WorkflowNodeCredentialSchema =
  SchemaFactory.createForClass(WorkflowNodeCredential);

const WORKFLOW_STATUSES: WorkflowStatus[] = [
  'Active',
  'Paused',
  'Draft',
  'Running',
  'Failed',
];

const WORKFLOW_TYPES: WorkflowType[] = [
  'generate-idea-posts',
  'generate-content-post',
];

@Schema({ timestamps: true, collection: 'workflows' })
export class Workflow {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ type: String })
  siteId?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: WORKFLOW_TYPES })
  type: WorkflowType;

  @Prop({ type: String, enum: WORKFLOW_STATUSES, default: 'Draft' })
  status: WorkflowStatus;

  @Prop({ type: String, enum: WORKFLOW_STATUSES, default: null })
  statusBeforeRun: WorkflowStatus | null;

  @Prop({ default: 0, min: 0 })
  triggers: number;

  @Prop({ default: '' })
  topic: string;

  @Prop({ default: false })
  useProductionWebhook: boolean;

  @Prop({ default: '' })
  webhookTestUrl: string;

  @Prop({ default: '' })
  webhookProductionUrl: string;

  @Prop({ type: [WorkflowNodeCredentialSchema], default: [] })
  nodeCredentials: WorkflowNodeCredential[];

  createdAt: Date;
  updatedAt: Date;
}

export const WorkflowSchema = SchemaFactory.createForClass(Workflow);

WorkflowSchema.index({ id: 1 }, { unique: true });
WorkflowSchema.index({ siteId: 1 }, { unique: true, sparse: true });
WorkflowSchema.index({ type: 1 });
WorkflowSchema.index({ updatedAt: -1 });
