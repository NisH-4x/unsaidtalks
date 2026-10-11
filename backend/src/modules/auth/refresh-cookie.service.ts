import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Request, Response } from 'express';
import { EnvironmentVariables } from '../../config/env.validation';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, REFRESH_TOKEN_TTL_MS } from './auth.constants';

@Injectable()
export class RefreshCookieService {
  private readonly options: CookieOptions;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    // httpOnly keeps the token away from JavaScript (XSS); SameSite=Strict stops other
    // sites from triggering refresh or logout requests with it (CSRF).
    this.options = {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      path: REFRESH_COOKIE_PATH,
    };
  }

  read(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[REFRESH_COOKIE_NAME];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  set(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE_NAME, token, { ...this.options, maxAge: REFRESH_TOKEN_TTL_MS });
  }

  clear(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, this.options);
  }
}
