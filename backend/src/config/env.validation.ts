import { plainToInstance, Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const NODE_ENVS = ['development', 'production', 'test'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

// Explicit type annotations are required: class-transformer reads them to convert
// the raw strings from process.env (for example PORT) into the declared types.
export class EnvironmentVariables {
  @IsIn(NODE_ENVS)
  NODE_ENV: NodeEnv = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @Matches(/^mongodb(\+srv)?:\/\//, {
    message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://',
  })
  @Matches(/^[^<>]*$/, {
    message:
      'MONGODB_URI still contains a <placeholder>; put the real connection string in backend/.env',
  })
  MONGODB_URI: string;

  /** Overrides the database named in MONGODB_URI, e.g. a separate database for automated tests. */
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,38}$/, {
    message: 'MONGODB_DB_NAME may only contain letters, digits, "_" and "-"',
  })
  MONGODB_DB_NAME?: string;

  @IsString()
  @MinLength(32, {
    message:
      'JWT_ACCESS_SECRET must be at least 32 characters (generate one with: ' +
      `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")`,
  })
  JWT_ACCESS_SECRET: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  CLIENT_ORIGIN: string = 'http://localhost:5173';

  /** Groq API key for AI summaries of open doubts. Without it the feature is off. */
  @IsOptional()
  @IsString()
  GROQ_API_KEY?: string;

  @Matches(/^[A-Za-z0-9./_-]+$/, {
    message: 'GROQ_MODEL must be a model name such as openai/gpt-oss-120b',
  })
  GROQ_MODEL: string = 'openai/gpt-oss-120b';

  /** "true" behind a reverse proxy (Render, Vercel), so rate limits see each visitor's own IP. */
  // Reads the raw string: implicit conversion would turn "false" into true.
  @Transform(
    ({ obj }: TransformFnParams) => (obj as Record<string, unknown>).TRUST_PROXY === 'true',
  )
  @IsBoolean()
  TRUST_PROXY: boolean = false;
}

// Error messages list only the failing variable names and rules, never the values,
// so a malformed connection string cannot leak credentials into logs.
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env);

  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.property}: ${Object.values(error.constraints ?? {}).join('; ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return env;
}
