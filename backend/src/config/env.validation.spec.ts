import { validateEnv } from './env.validation';

const validUri = 'mongodb+srv://app_user:s3cret@cluster0.example.mongodb.net/unsaidtalks';
const required = { MONGODB_URI: validUri, JWT_ACCESS_SECRET: 'x'.repeat(48) };

function errorMessageOf(config: Record<string, unknown>): string {
  try {
    validateEnv(config);
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

describe('validateEnv', () => {
  it('accepts a complete configuration and converts numeric values', () => {
    const env = validateEnv({ ...required, PORT: '4000', NODE_ENV: 'test' });

    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('test');
    expect(env.MONGODB_URI).toBe(validUri);
  });

  it('applies defaults for optional values', () => {
    const env = validateEnv(required);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.CLIENT_ORIGIN).toBe('http://localhost:5173');
    expect(env.MONGODB_DB_NAME).toBeUndefined();
    expect(env.TRUST_PROXY).toBe(false);
  });

  it('trusts a reverse proxy only when TRUST_PROXY is exactly "true"', () => {
    expect(validateEnv({ ...required, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
    expect(validateEnv({ ...required, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    expect(validateEnv({ ...required, TRUST_PROXY: 'yes' }).TRUST_PROXY).toBe(false);
  });

  it('rejects a missing MONGODB_URI', () => {
    expect(errorMessageOf({ JWT_ACCESS_SECRET: required.JWT_ACCESS_SECRET })).toContain(
      'MONGODB_URI',
    );
  });

  it('rejects a connection string that still has template placeholders', () => {
    const templated =
      'mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/unsaidtalks';

    expect(errorMessageOf({ ...required, MONGODB_URI: templated })).toContain('placeholder');
  });

  it('never includes the connection string in the error message', () => {
    const message = errorMessageOf({
      ...required,
      MONGODB_URI: 'postgres://app_user:s3cret@localhost/unsaidtalks',
    });

    expect(message).toContain('MONGODB_URI');
    expect(message).not.toContain('s3cret');
  });

  it('rejects a JWT secret that is too short to be safe', () => {
    expect(errorMessageOf({ ...required, JWT_ACCESS_SECRET: 'short' })).toContain(
      'JWT_ACCESS_SECRET',
    );
  });

  it('rejects database names with unsafe characters', () => {
    expect(errorMessageOf({ ...required, MONGODB_DB_NAME: 'unsaidtalks/test' })).toContain(
      'MONGODB_DB_NAME',
    );
  });
});
