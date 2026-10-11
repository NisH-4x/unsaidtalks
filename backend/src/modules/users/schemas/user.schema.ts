import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const USER_ROLES = ['admin', 'mentor', 'mentee'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SIGNUP_ROLES = ['mentee', 'mentor'] as const satisfies readonly UserRole[];
export type SignupRole = (typeof SIGNUP_ROLES)[number];

/** Only `active` accounts can sign in. Mentor signups start as `pending_approval`. */
export const ACCOUNT_STATUSES = ['active', 'pending_approval', 'rejected', 'deactivated'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 60 })
  name: string;

  // Login identifier only. It is never included in data sent about a user to other users.
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 254 })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: String, required: true, enum: USER_ROLES, default: 'mentee' })
  role: UserRole;

  @Prop({ type: String, required: true, enum: ACCOUNT_STATUSES, default: 'active' })
  status: AccountStatus;

  @Prop({ type: Date, default: null })
  lastSeenAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ status: 1, role: 1, createdAt: 1 });
