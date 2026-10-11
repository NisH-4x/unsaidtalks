export type UserRole = 'admin' | 'mentor' | 'mentee';
export type SignupRole = Exclude<UserRole, 'admin'>;
export type AccountStatus = 'active' | 'pending_approval' | 'rejected' | 'deactivated';

export interface PublicUser {
  id: string;
  name: string;
  role: UserRole;
}

/** Someone the viewer shares a conversation with. */
export interface ContactUser extends PublicUser {
  lastSeenAt: string | null;
}

export interface CurrentUser extends PublicUser {
  email: string;
  status: AccountStatus;
}

export interface AdminUser extends CurrentUser {
  createdAt: string;
}
