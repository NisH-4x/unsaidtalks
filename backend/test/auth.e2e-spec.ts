import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { REFRESH_REUSE_GRACE_MS } from '../src/modules/auth/auth.constants';
import { RefreshToken } from '../src/modules/auth/schemas/refresh-token.schema';
import {
  clearDatabase,
  createTestApp,
  insertUser,
  loginAs,
  rawSetCookie,
  refreshCookieFrom,
  TEST_PASSWORD,
  TestApp,
} from './utils/test-app';

interface AuthBody {
  status?: string;
  accessToken?: string;
  user: { id: string; name: string; email: string; role: string; status: string };
  code?: string;
  message?: string | string[];
}

describe('Authentication (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await clearDatabase(t.connection);
  });

  afterAll(async () => {
    await t.close();
  });

  const signup = (body: Record<string, unknown>) => t.http().post('/api/auth/signup').send(body);
  const refresh = (token?: string) => {
    const req = t.http().post('/api/auth/refresh');
    return token ? req.set('Cookie', `refresh_token=${token}`) : req;
  };

  describe('signup', () => {
    it('signs a mentee in immediately with an access token and a secure refresh cookie', async () => {
      const response = await signup({
        name: '  Riya Kapoor ',
        email: 'Riya@Example.com',
        password: TEST_PASSWORD,
        role: 'mentee',
      }).expect(201);

      const body = response.body as AuthBody;
      expect(body.status).toBe('active');
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user).toMatchObject({
        name: 'Riya Kapoor',
        email: 'riya@example.com',
        role: 'mentee',
        status: 'active',
      });
      expect(body.user).not.toHaveProperty('passwordHash');

      const cookie = rawSetCookie(response);
      expect(cookie).toMatch(/refresh_token=[^;]+/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
    });

    it('creates mentor signups as pending approval without starting a session', async () => {
      const response = await signup({
        name: 'Dev Arora',
        email: 'dev@example.com',
        password: TEST_PASSWORD,
        role: 'mentor',
      }).expect(201);

      const body = response.body as AuthBody;
      expect(body.status).toBe('pending_approval');
      expect(body.accessToken).toBeUndefined();
      expect(refreshCookieFrom(response)).toBeUndefined();
    });

    it('does not allow signing up as an admin', async () => {
      await signup({
        name: 'Sneaky',
        email: 'sneaky@example.com',
        password: TEST_PASSWORD,
        role: 'admin',
      }).expect(400);
    });

    it('rejects extra fields such as a self-assigned status', async () => {
      await signup({
        name: 'Sneaky',
        email: 'sneaky@example.com',
        password: TEST_PASSWORD,
        role: 'mentor',
        status: 'active',
      }).expect(400);
    });

    it('rejects weak passwords and invalid emails', async () => {
      const weak = await signup({
        name: 'Weak',
        email: 'weak@example.com',
        password: 'password',
        role: 'mentee',
      }).expect(400);
      expect(JSON.stringify(weak.body)).toContain('at least one number');

      await signup({
        name: 'Bad Email',
        email: 'not-an-email',
        password: TEST_PASSWORD,
        role: 'mentee',
      }).expect(400);
    });

    it('rejects a duplicate email regardless of letter case', async () => {
      const details = { name: 'First', password: TEST_PASSWORD, role: 'mentee' };
      await signup({ ...details, email: 'same@example.com' }).expect(201);
      await signup({ ...details, email: 'SAME@example.com' }).expect(409);
    });
  });

  describe('login', () => {
    it('returns the same error for a wrong password and an unknown email', async () => {
      await insertUser(t, { name: 'Asha', email: 'asha@example.com', role: 'mentee' });

      const wrongPassword = await t
        .http()
        .post('/api/auth/login')
        .send({ email: 'asha@example.com', password: 'Wrong12345' })
        .expect(401);
      const unknownEmail = await t
        .http()
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'Wrong12345' })
        .expect(401);

      expect((wrongPassword.body as AuthBody).message).toBe('Invalid email or password');
      expect((unknownEmail.body as AuthBody).message).toBe('Invalid email or password');
    });

    it.each([
      ['pending_approval', 'ACCOUNT_PENDING'],
      ['rejected', 'ACCOUNT_REJECTED'],
      ['deactivated', 'ACCOUNT_DEACTIVATED'],
    ] as const)('blocks %s accounts with code %s', async (status, code) => {
      await insertUser(t, {
        name: 'Blocked',
        email: 'blocked@example.com',
        role: 'mentor',
        status,
      });

      const response = await t
        .http()
        .post('/api/auth/login')
        .send({ email: 'blocked@example.com', password: TEST_PASSWORD })
        .expect(403);

      expect((response.body as AuthBody).code).toBe(code);
      expect(refreshCookieFrom(response)).toBeUndefined();
    });
  });

  describe('protected routes', () => {
    it('requires a valid access token', async () => {
      await t.http().get('/api/auth/me').expect(401);
      await t.http().get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });

    it('returns the signed-in user without the password hash', async () => {
      await insertUser(t, { name: 'Asha', email: 'asha@example.com', role: 'mentee' });
      const token = await loginAs(t, 'asha@example.com');

      const response = await t
        .http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({ email: 'asha@example.com', role: 'mentee' });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('rejects a still-valid token once the account is deactivated', async () => {
      const user = await insertUser(t, { name: 'Asha', email: 'asha@example.com', role: 'mentee' });
      const token = await loginAs(t, 'asha@example.com');
      await user.updateOne({ status: 'deactivated' });

      await t.http().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('keeps the health check public', async () => {
      await t.http().get('/api/health').expect(200);
    });
  });

  describe('refresh and logout', () => {
    async function signedInCookie(): Promise<string> {
      await insertUser(t, { name: 'Asha', email: 'asha@example.com', role: 'mentee' });
      const response = await t
        .http()
        .post('/api/auth/login')
        .send({ email: 'asha@example.com', password: TEST_PASSWORD })
        .expect(200);
      const cookie = refreshCookieFrom(response);
      if (!cookie) throw new Error('Login did not set a refresh cookie');
      return cookie;
    }

    it('issues a new access token and rotates the refresh cookie', async () => {
      const original = await signedInCookie();

      const response = await refresh(original).expect(200);
      const rotated = refreshCookieFrom(response);

      expect((response.body as AuthBody).accessToken).toEqual(expect.any(String));
      expect((response.body as AuthBody).user.email).toBe('asha@example.com');
      expect(rotated).toBeDefined();
      expect(rotated).not.toBe(original);
      await refresh(rotated).expect(200);
    });

    it('fails without a cookie', async () => {
      await refresh().expect(401);
    });

    it('tolerates a concurrent refresh from another tab within the grace window', async () => {
      const original = await signedInCookie();
      await refresh(original).expect(200);

      const raced = await refresh(original).expect(200);
      expect((raced.body as AuthBody).accessToken).toEqual(expect.any(String));
      expect(refreshCookieFrom(raced)).toBeUndefined();
    });

    it('ends every session when an old refresh token is reused after the grace window', async () => {
      const original = await signedInCookie();
      const rotated = refreshCookieFrom(await refresh(original).expect(200));

      const refreshTokens = t.app.get<Model<RefreshToken>>(getModelToken(RefreshToken.name));
      await refreshTokens.updateMany(
        { rotatedAt: { $ne: null } },
        { rotatedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1000) },
      );

      await refresh(original).expect(401);
      await refresh(rotated).expect(401);
    });

    it('logout revokes the refresh token and clears the cookie', async () => {
      const cookie = await signedInCookie();

      const response = await t
        .http()
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${cookie}`)
        .expect(204);

      expect(rawSetCookie(response)).toMatch(/refresh_token=;/);
      await refresh(cookie).expect(401);
    });
  });
});
