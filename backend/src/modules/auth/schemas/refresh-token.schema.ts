import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

/**
 * One row per issued refresh token. Only a SHA-256 hash of the token is stored,
 * so a database leak does not expose usable sessions.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class RefreshToken {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  /** Set when the token is exchanged for a new one. */
  @Prop({ type: Date, default: null })
  rotatedAt: Date | null;

  /** Set on logout, account changes or suspected token theft. */
  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  createdAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
