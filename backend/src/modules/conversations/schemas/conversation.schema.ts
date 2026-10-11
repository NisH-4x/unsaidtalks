import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { MESSAGE_TYPES, MessageType } from '../../messages/schemas/message.schema';

export const CONVERSATION_TYPES = ['group', 'direct'] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

@Schema({ _id: false })
export class LastMessage {
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

  @Prop({ type: Date, required: true })
  sentAt: Date;
}

export const LastMessageSchema = SchemaFactory.createForClass(LastMessage);

function isGroup(this: Conversation): boolean {
  return this.type === 'group';
}

function isDirect(this: Conversation): boolean {
  return this.type === 'direct';
}

function hasTwoParticipants(this: Conversation, ids: Types.ObjectId[] | undefined): boolean {
  return this.type !== 'direct' || ids?.length === 2;
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: String, required: true, enum: CONVERSATION_TYPES })
  type: ConversationType;

  @Prop({ trim: true, maxlength: 80, required: isGroup })
  name?: string;

  @Prop({ trim: true, maxlength: 500, default: '' })
  description: string;

  @Prop({ trim: true, maxlength: 80 })
  program?: string;

  @Prop({ trim: true, maxlength: 40 })
  batch?: string;

  @Prop({ default: false })
  allowMenteeDirectChat: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({
    type: [{ type: SchemaTypes.ObjectId, ref: 'User' }],
    default: undefined,
    validate: {
      validator: hasTwoParticipants,
      message: 'A direct chat needs exactly two participants',
    },
  })
  participantIds?: Types.ObjectId[];

  @Prop({ required: isDirect })
  directKey?: string;

  @Prop({ type: LastMessageSchema, default: null })
  lastMessage: LastMessage | null;

  @Prop({ type: Date, default: () => new Date() })
  lastActivityAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index(
  { directKey: 1 },
  { unique: true, partialFilterExpression: { directKey: { $type: 'string' } } },
);
ConversationSchema.index({ type: 1, lastActivityAt: -1 });

// One canonical key per pair of users, regardless of who starts the chat,
// so the unique index prevents duplicate direct chats.
export function directKeyFor(userA: Types.ObjectId, userB: Types.ObjectId): string {
  return [userA.toHexString(), userB.toHexString()].sort().join(':');
}
