import { Request } from 'express';
import { UserRole } from '../users/schemas/user.schema';

/** The identity attached to every authenticated request. */
export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
