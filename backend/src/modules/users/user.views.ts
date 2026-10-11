import { Types } from 'mongoose';
import { AccountStatus, User, UserRole } from './schemas/user.schema';

type StoredUser = User & { _id: Types.ObjectId };

/** What any user may see about another user. Never contains contact details. */
export interface PublicUserView {
  id: string;
  name: string;
  role: UserRole;
}

/** A person the viewer shares a conversation with, including when they were last online. */
export interface ContactView extends PublicUserView {
  lastSeenAt: Date | null;
}

/** What a signed-in user sees about themselves. */
export interface CurrentUserView extends PublicUserView {
  email: string;
  status: AccountStatus;
}

/** What an admin sees in the management screens. */
export interface AdminUserView extends CurrentUserView {
  createdAt: Date;
}

export function toPublicUserView(user: StoredUser): PublicUserView {
  return { id: user._id.toHexString(), name: user.name, role: user.role };
}

export function toContactView(user: StoredUser): ContactView {
  return { ...toPublicUserView(user), lastSeenAt: user.lastSeenAt };
}

export function toCurrentUserView(user: StoredUser): CurrentUserView {
  return { ...toPublicUserView(user), email: user.email, status: user.status };
}

export function toAdminUserView(user: StoredUser): AdminUserView {
  return { ...toCurrentUserView(user), createdAt: user.createdAt };
}
