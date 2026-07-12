import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Shared webhook fields — mọi workflow type */
@Schema({ _id: false })
export class WorkflowWebhookFields {
  @Prop({ default: false })
  useProductionWebhook: boolean;

  @Prop({ default: '' })
  webhookTestUrl: string;

  @Prop({ default: '' })
  webhookProductionUrl: string;
}

export const WorkflowWebhookFieldsSchema =
  SchemaFactory.createForClass(WorkflowWebhookFields);
