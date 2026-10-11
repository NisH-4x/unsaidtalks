import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

/** One exported WhatsApp chat imported into a group. */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ChatImport {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  importedBy: Types.ObjectId;

  @Prop({ required: true, maxlength: 255 })
  fileName: string;

  /** SHA-256 of the file, so the same export cannot be imported into a group twice. */
  @Prop({ required: true })
  fileHash: string;

  @Prop({ required: true, min: 0 })
  importedCount: number;

  /** Messages left out because an earlier import already contained them. */
  @Prop({ required: true, min: 0 })
  skippedCount: number;

  @Prop({ type: Date, required: true })
  firstMessageAt: Date;

  @Prop({ type: Date, required: true })
  lastMessageAt: Date;

  createdAt: Date;
}

export type ChatImportDocument = HydratedDocument<ChatImport>;
export const ChatImportSchema = SchemaFactory.createForClass(ChatImport);

ChatImportSchema.index({ conversationId: 1, fileHash: 1 }, { unique: true });
