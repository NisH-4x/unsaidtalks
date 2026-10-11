import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Membership {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  unreadCount: number;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  lastReadMessageId: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  addedBy: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export type MembershipDocument = HydratedDocument<Membership>;
export const MembershipSchema = SchemaFactory.createForClass(Membership);

MembershipSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
MembershipSchema.index({ userId: 1 });
