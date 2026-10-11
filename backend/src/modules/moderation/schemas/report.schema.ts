import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  Attachment,
  AttachmentSchema,
  MESSAGE_TYPES,
  MessageType,
} from '../../messages/schemas/message.schema';

export const REPORT_REASONS = ['spam', 'abuse', 'personal_info', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'dismissed', 'actioned'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

// Taken when the report is filed, so admins can still review the content
// after the sender deletes the original message.
@Schema({ _id: false })
export class ReportedMessageSnapshot {
  /** Null for imported history from someone without an account. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  senderId: Types.ObjectId | null;

  @Prop({ required: true })
  senderName: string;

  @Prop({ type: String, required: true, enum: MESSAGE_TYPES })
  type: MessageType;

  @Prop({ default: '' })
  text: string;

  @Prop({ type: AttachmentSchema, default: null })
  attachment: Attachment | null;

  @Prop({ type: Date, required: true })
  sentAt: Date;
}

export const ReportedMessageSnapshotSchema = SchemaFactory.createForClass(ReportedMessageSnapshot);

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  reportedBy: Types.ObjectId;

  @Prop({ type: String, required: true, enum: REPORT_REASONS })
  reason: ReportReason;

  @Prop({ trim: true, default: '', maxlength: 500 })
  note: string;

  @Prop({ type: ReportedMessageSnapshotSchema, required: true })
  messageSnapshot: ReportedMessageSnapshot;

  @Prop({ type: String, required: true, enum: REPORT_STATUSES, default: 'open' })
  status: ReportStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  reviewedBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type ReportDocument = HydratedDocument<Report>;
export const ReportSchema = SchemaFactory.createForClass(Report);

ReportSchema.index({ messageId: 1, reportedBy: 1 }, { unique: true });
ReportSchema.index({ status: 1, _id: -1 });
