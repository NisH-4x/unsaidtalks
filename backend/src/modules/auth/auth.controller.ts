import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshCookieService } from './refresh-cookie.service';

const CREDENTIAL_ATTEMPTS = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshCookie: RefreshCookieService,
  ) {}

  @Public()
  @Throttle(CREDENTIAL_ATTEMPTS)
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.signup(dto);
    if (result.status === 'pending_approval') return result;

    this.refreshCookie.set(response, result.refreshToken);
    return { status: result.status, user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Throttle(CREDENTIAL_ATTEMPTS)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.login(dto);
    this.refreshCookie.set(response, session.refreshToken);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const session = await this.authService.refresh(this.refreshCookie.read(request));
      if (session.refreshToken) this.refreshCookie.set(response, session.refreshToken);
      return { user: session.user, accessToken: session.accessToken };
    } catch (error) {
      this.refreshCookie.clear(response);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(this.refreshCookie.read(request));
    this.refreshCookie.clear(response);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.currentUser(user.id);
  }
}
