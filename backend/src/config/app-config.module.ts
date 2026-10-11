import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  validate: validateEnv,
});
