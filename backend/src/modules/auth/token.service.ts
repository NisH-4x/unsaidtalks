import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { REFRESH_REUSE_GRACE_MS, REFRESH_TOKEN_TTL_MS } from './auth.constants';
import { RefreshToken } from './schemas/refresh-token.schema';

interface AccessTokenPayload {
  sub: string;
}

export interface RotationResult {
  userId: string;
  /** Null when the presented token lost a concurrent-refresh race; the browser already holds the newer cookie. */
  refreshToken: string | null;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshToken>,
  ) {}

  signAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId } satisfies AccessTokenPayload);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async issueRefreshToken(userId: string | Types.ObjectId): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.refreshTokenModel.create({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
    return token;
  }

  async rotateRefreshToken(token: string): Promise<RotationResult> {
    const tokenHash = hashToken(token);
    const now = new Date();

    const current = await this.refreshTokenModel
      .findOneAndUpdate(
        { tokenHash, rotatedAt: null, revokedAt: null, expiresAt: { $gt: now } },
        { rotatedAt: now },
      )
      .exec();
    if (current) {
      return {
        userId: current.userId.toHexString(),
        refreshToken: await this.issueRefreshToken(current.userId),
      };
    }

    const previous = await this.refreshTokenModel.findOne({ tokenHash }).exec();
    if (previous?.rotatedAt && !previous.revokedAt && previous.expiresAt > now) {
      if (now.getTime() - previous.rotatedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
        return { userId: previous.userId.toHexString(), refreshToken: null };
      }
      // An already-rotated token used again long after rotation means a copy of it
      // exists somewhere else, so every session of this user is ended.
      await this.revokeAllForUser(previous.userId);
    }

    throw new UnauthorizedException('Your session has expired. Please sign in again.');
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.refreshTokenModel
      .updateOne({ tokenHash: hashToken(token), revokedAt: null }, { revokedAt: new Date() })
      .exec();
  }

  async revokeAllForUser(userId: string | Types.ObjectId): Promise<void> {
    await this.refreshTokenModel
      .updateMany({ userId, revokedAt: null }, { revokedAt: new Date() })
      .exec();
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
