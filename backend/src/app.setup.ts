import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { EnvironmentVariables } from './config/env.validation';

/** Shared by main.ts and the end-to-end tests so both run the exact same HTTP pipeline. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Behind Vercel and Render every request arrives from a proxy. Vercel replaces
  // X-Forwarded-For with the visitor's address, so trusting it gives each visitor their own
  // rate limits instead of one shared limit for the proxy.
  if (config.get('TRUST_PROXY', { infer: true })) app.set('trust proxy', true);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get('CLIENT_ORIGIN', { infer: true }), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
