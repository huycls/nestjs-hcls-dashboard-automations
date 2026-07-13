import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** WordPress — site URL + auth optional */
@Schema({ _id: false })
export class WordpressConfig {
  @Prop({ required: true, default: '' })
  siteUrl: string;

  @Prop({ type: String, default: undefined })
  username?: string;

  @Prop({ type: String, default: undefined })
  appPassword?: string;
}

export const WordpressConfigSchema =
  SchemaFactory.createForClass(WordpressConfig);
