import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword } from '../../common/security/password';
import { AccountStatus, UserDocument } from '../users/schemas/user.schema';
import { CurrentUserView, toCurrentUserView } from '../users/user.views';
import { UsersService } from '../users/users.service';
import { AuthUser } from './auth-user';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { TokenService } from './token.service';

export interface Session {
  user: CurrentUserView;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshedSession extends Omit<Session, 'refreshToken'> {
  refreshToken: string | null;
}

export type SignupResult =
  ({ status: 'active' } & Session) | { status: 'pending_approval'; user: CurrentUserView };

const SIGN_IN_BLOCKED: Record<
  Exclude<AccountStatus, 'active'>,
  { code: string; message: string }
> = {
  pending_approval: {
    code: 'ACCOUNT_PENDING',
    message: 'Your mentor account is waiting for admin approval.',
  },
  rejected: {
    code: 'ACCOUNT_REJECTED',
    message: 'Your mentor application was not approved. Please contact the UnsaidTalks team.',
  },
  deactivated: {
    code: 'ACCOUNT_DEACTIVATED',
    message: 'This account has been deactivated.',
  },
};

@Injectable()
export class AuthService {
  // Compared against when an email is unknown, so a failed login takes the same
  // time whether or not the account exists (prevents probing for registered emails).
  private readonly unknownUserHash = hashPassword(randomBytes(16).toString('hex'));

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async signup(dto: SignupDto): Promise<SignupResult> {
    const status: AccountStatus = dto.role === 'mentor' ? 'pending_approval' : 'active';
    const user = await this.users.create({ ...dto, status });

    if (status === 'pending_approval') {
      return { status, user: toCurrentUserView(user) };
    }
    return { status: 'active', ...(await this.startSession(user)) };
  }

  async login({ email, password }: LoginDto): Promise<Session> {
    const user = await this.users.findByEmailWithPassword(email);
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.unknownUserHash),
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'active') {
      const { code, message } = SIGN_IN_BLOCKED[user.status];
      throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code, message });
    }

    return this.startSession(user);
  }

  async refresh(refreshToken: string | undefined): Promise<RefreshedSession> {
    if (!refreshToken) throw new UnauthorizedException('No active session');

    const rotation = await this.tokens.rotateRefreshToken(refreshToken);
    const user = await this.users.findById(rotation.userId);
    if (!user || user.status !== 'active') {
      await this.tokens.revokeAllForUser(rotation.userId);
      throw new UnauthorizedException('Your session is no longer valid. Please sign in again.');
    }

    return {
      user: toCurrentUserView(user),
      accessToken: await this.tokens.signAccessToken(user._id.toHexString()),
      refreshToken: rotation.refreshToken,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.tokens.revokeRefreshToken(refreshToken);
  }

  /** Resolves a bearer token to the current user, re-checking the account on every request. */
  async authenticate(accessToken: string): Promise<AuthUser> {
    const { sub } = await this.tokens.verifyAccessToken(accessToken);
    const user = await this.users.findById(sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Your session is no longer valid. Please sign in again.');
    }
    return { id: user._id.toHexString(), name: user.name, role: user.role };
  }

  async currentUser(userId: string): Promise<CurrentUserView> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Your session is no longer valid.');
    return toCurrentUserView(user);
  }

  private async startSession(user: UserDocument): Promise<Session> {
    return {
      user: toCurrentUserView(user),
      accessToken: await this.tokens.signAccessToken(user._id.toHexString()),
      refreshToken: await this.tokens.issueRefreshToken(user._id),
    };
  }
}
