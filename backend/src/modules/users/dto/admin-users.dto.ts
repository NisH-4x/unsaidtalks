import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/validation/transforms';
import { ACCOUNT_STATUSES, AccountStatus, USER_ROLES, UserRole } from '../schemas/user.schema';

export class ListUsersQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @IsOptional()
  @IsIn(ACCOUNT_STATUSES)
  status?: AccountStatus;
}

export const ADMIN_ASSIGNABLE_ROLES = ['mentor', 'mentee'] as const;
export const ADMIN_ASSIGNABLE_STATUSES = ['active', 'deactivated'] as const;

export class UpdateUserByAdminDto {
  @IsOptional()
  @IsIn(ADMIN_ASSIGNABLE_ROLES, { message: 'Role must be mentor or mentee' })
  role?: (typeof ADMIN_ASSIGNABLE_ROLES)[number];

  @IsOptional()
  @IsIn(ADMIN_ASSIGNABLE_STATUSES, { message: 'Status must be active or deactivated' })
  status?: (typeof ADMIN_ASSIGNABLE_STATUSES)[number];
}
