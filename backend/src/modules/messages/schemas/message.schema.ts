import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export const MESSAGE_TYPES = ['text', 'image', 'file', 'system'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const DOUBT_STATUSES = ['open', 'resolved'] as const;
export type DoubtStatus = (typeof DOUBT_STATUSES)[number];

export const MESSAGE_TEXT_MAX_LENGTH = 4000;

/** How long after sending the sender may still edit a message. */
export const EDIT_WINDOW_MS = 5 * 60 * 1000;

@Schema({ _id: false })
export class Attachment {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  fileId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 255 })
  name: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true, min: 0 })
  size: number;

  /** Pixel size reported by the uploader's browser, used only to reserve space while loading. */
  @Prop({ type: Number, default: null })
  width: number | null;

  @Prop({ type: Number, default: null })
  height: number | null;
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

// A copy of the quoted message, so the quote renders even when the original
// is outside the loaded page of history.
@Schema({ _id: false })
export class ReplySnapshot {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  messageId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  senderId: Types.ObjectId | null;

  @Prop({ default: '' })
  senderName: string;

  @Prop({ type: String, required: true, enum: MESSAGE_TYPES })
  type: MessageType;

  @Prop({ default: '' })
  preview: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const ReplySnapshotSchema = SchemaFactory.createForClass(ReplySnapshot);

@Schema({ _id: false })
export class PinInfo {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  pinnedBy: Types.ObjectId;

  @Prop({ type: Date, required: true })
  pinnedAt: Date;
}

export const PinInfoSchema = SchemaFactory.createForClass(PinInfo);

/** The reactions people can add, kept small so that every client can show them the same way. */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🙏', '🎉'] as const;

@Schema({ _id: false })
export class Reaction {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: REACTION_EMOJIS })
  emoji: string;
}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);

@Schema({ _id: false })
export class DoubtInfo {
  @Prop({ type: String, required: true, enum: DOUBT_STATUSES, default: 'open' })
  status: DoubtStatus;

  @Prop({ type: Date, required: true })
  markedAt: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  resolvedBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;
}

export const DoubtInfoSchema = SchemaFactory.createForClass(DoubtInfo);

/** Where an imported message came from; its sender may have no account here. */
@Schema({ _id: false })
export class ImportInfo {
  @Prop({ type: String, required: true, enum: ['whatsapp'] })
  source: 'whatsapp';

  /** The name as it appeared in the export. */
  @Prop({ required: true, maxlength: 200 })
  senderName: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ChatImport', required: true })
  batchId: Types.ObjectId;

  /** Identifies the message across exports, so overlapping imports skip what is already here. */
  @Prop({ required: true })
  fingerprint: string;
}

export const ImportInfoSchema = SchemaFactory.createForClass(ImportInfo);

// Imported messages may come from people without an account; every other message has a sender.
function needsSender(this: Message): boolean {
  return this.type !== 'system' && !this.import;
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null, required: needsSender })
  senderId: Types.ObjectId | null;

  @Prop({ type: String, required: true, enum: MESSAGE_TYPES, default: 'text' })
  type: MessageType;

  @Prop({ default: '', maxlength: MESSAGE_TEXT_MAX_LENGTH })
  text: string;

  @Prop({ type: AttachmentSchema, default: null })
  attachment: Attachment | null;

  @Prop({ type: ReplySnapshotSchema, default: null })
  replyTo: ReplySnapshot | null;

  @Prop({ default: false })
  isAnnouncement: boolean;

  @Prop({ type: PinInfoSchema, default: null })
  pin: PinInfo | null;

  @Prop({ type: DoubtInfoSchema, default: null })
  doubt: DoubtInfo | null;

  @Prop({ type: [ReactionSchema], default: [] })
  reactions: Reaction[];

  @Prop({ type: Date, default: null })
  editedAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  deletedBy: Types.ObjectId | null;

  @Prop({ type: ImportInfoSchema, default: null })
  import: ImportInfo | null;

  /** The sender's temporary id for the message; makes resending after a timeout safe. */
  @Prop({ maxlength: 64 })
  clientId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);

// ObjectIds increase over time, so (conversationId, _id) gives stable cursor pagination.
MessageSchema.index({ conversationId: 1, _id: -1 });
MessageSchema.index(
  { conversationId: 1, 'pin.pinnedAt': -1 },
  { partialFilterExpression: { pin: { $type: 'object' } } },
);
MessageSchema.index(
  { conversationId: 1, 'doubt.status': 1, _id: -1 },
  { partialFilterExpression: { doubt: { $type: 'object' } } },
);
MessageSchema.index(
  { conversationId: 1, isAnnouncement: 1, _id: -1 },
  { partialFilterExpression: { isAnnouncement: true } },
);
MessageSchema.index(
  { senderId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } },
);
MessageSchema.index(
  { conversationId: 1, 'import.fingerprint': 1 },
  { unique: true, partialFilterExpression: { 'import.fingerprint': { $type: 'string' } } },
);
// Word search within one conversation: the leading equality key keeps every search to a
// single conversation's entries in the index. Captions and file names are both searched.
MessageSchema.index(
  { conversationId: 1, text: 'text', 'attachment.name': 'text' },
  { name: 'message_search', default_language: 'english' },
);
