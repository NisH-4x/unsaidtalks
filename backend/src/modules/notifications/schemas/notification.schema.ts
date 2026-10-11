import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export const NOTIFICATION_TYPES = ['reply', 'announcement', 'doubt_resolved'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: NOTIFICATION_TYPES })
  type: NotificationType;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  @Prop({ default: '', maxlength: 160 })
  preview: string;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  createdAt: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, _id: -1 });
NotificationSchema.index({ userId: 1, readAt: 1 });
