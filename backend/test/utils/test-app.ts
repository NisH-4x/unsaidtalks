import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Connection, Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { hashPassword } from '../../src/common/security/password';
import {
  AccountStatus,
  User,
  UserDocument,
  UserRole,
} from '../../src/modules/users/schemas/user.schema';

export const TEST_PASSWORD = 'Testing123';

export interface TestApp {
  app: NestExpressApplication;
  connection: Connection;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
  /** Base URL of the running server; only set when created with `listen: true`. */
  url: string;
}

/** A provider replaced for a test, such as a fake client for an external API. */
export interface ProviderOverride {
  provide: unknown;
  useValue: unknown;
}

export async function createTestApp({
  listen = false,
  overrides = [] as ProviderOverride[],
} = {}): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  for (const { provide, useValue } of overrides)
    builder.overrideProvider(provide).useValue(useValue);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  let url = '';
  if (listen) {
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
  } else {
    await app.init();
  }

  const connection = app.get<Connection>(getConnectionToken());
  if (!connection.name.endsWith('_test')) {
    await app.close();
    throw new Error(`Refusing to run e2e tests against database "${connection.name}"`);
  }

  return {
    app,
    connection,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
    url,
  };
}

/** Empties every collection, including the GridFS ones that have no Mongoose model. */
export async function clearDatabase(connection: Connection): Promise<void> {
  const collections = (await connection.db?.collections()) ?? [];
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

let passwordHash: Promise<string> | undefined;

export async function insertUser(
  testApp: TestApp,
  user: { name: string; email: string; role: UserRole; status?: AccountStatus },
): Promise<UserDocument> {
  passwordHash ??= hashPassword(TEST_PASSWORD);
  const userModel = testApp.app.get<Model<User>>(getModelToken(User.name));
  return userModel.create({ status: 'active', ...user, passwordHash: await passwordHash });
}

export async function loginAs(testApp: TestApp, email: string): Promise<string> {
  const response = await testApp
    .http()
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);
  return (response.body as { accessToken: string }).accessToken;
}

export interface SignedInUser {
  user: UserDocument;
  token: string;
  id: string;
}

export async function signedInUser(
  testApp: TestApp,
  user: { name: string; email: string; role: UserRole },
): Promise<SignedInUser> {
  const created = await insertUser(testApp, user);
  return {
    user: created,
    token: await loginAs(testApp, user.email),
    id: created._id.toHexString(),
  };
}

/** Request helpers that send the given access token. */
export function asUser(testApp: TestApp, token: string) {
  const bearer = `Bearer ${token}`;
  return {
    get: (path: string) => testApp.http().get(path).set('Authorization', bearer),
    post: (path: string, body: object = {}) =>
      testApp.http().post(path).set('Authorization', bearer).send(body),
    patch: (path: string, body: object = {}) =>
      testApp.http().patch(path).set('Authorization', bearer).send(body),
    delete: (path: string) => testApp.http().delete(path).set('Authorization', bearer),
  };
}

/** Returns the refresh token value from a Set-Cookie header, if present. */
export function refreshCookieFrom(response: request.Response): string | undefined {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies.find((value) => value.startsWith('refresh_token='));
  const token = cookie?.split(';')[0].slice('refresh_token='.length);
  return token || undefined;
}

export function rawSetCookie(response: request.Response): string {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  return (Array.isArray(header) ? header : [header ?? '']).join('\n');
}
