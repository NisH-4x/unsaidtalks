import { Types } from 'mongoose';
import {
  clearDatabase,
  createTestApp,
  insertUser,
  loginAs,
  TEST_PASSWORD,
  TestApp,
} from './utils/test-app';

interface ApplicantView {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

describe('Mentor applications (e2e)', () => {
  let t: TestApp;
  let adminToken: string;
  let applicantId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await clearDatabase(t.connection);
    await insertUser(t, { name: 'Admin', email: 'admin@example.com', role: 'admin' });
    const applicant = await insertUser(t, {
      name: 'Dev Arora',
      email: 'dev@example.com',
      role: 'mentor',
      status: 'pending_approval',
    });
    applicantId = applicant._id.toHexString();
    adminToken = await loginAs(t, 'admin@example.com');
  });

  afterAll(async () => {
    await t.close();
  });

  const asAdmin = (method: 'get' | 'post', path: string) =>
    t.http()[method](path).set('Authorization', `Bearer ${adminToken}`);

  const login = (email: string) =>
    t.http().post('/api/auth/login').send({ email, password: TEST_PASSWORD });

  it('lists pending mentor applications for admins', async () => {
    const response = await asAdmin('get', '/api/admin/mentor-applications').expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: applicantId,
        email: 'dev@example.com',
        status: 'pending_approval',
      }) as ApplicantView,
    ]);
  });

  it.each(['mentee', 'mentor'] as const)('refuses access to a %s', async (role) => {
    await insertUser(t, { name: 'Member', email: `${role}@example.com`, role });
    const token = await loginAs(t, `${role}@example.com`);

    await t
      .http()
      .get('/api/admin/mentor-applications')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await t
      .http()
      .post(`/api/admin/mentor-applications/${applicantId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('approving lets the mentor sign in', async () => {
    await login('dev@example.com').expect(403);

    const response = await asAdmin(
      'post',
      `/api/admin/mentor-applications/${applicantId}/approve`,
    ).expect(200);

    expect((response.body as ApplicantView).status).toBe('active');
    const signedIn = await login('dev@example.com').expect(200);
    expect((signedIn.body as { user: ApplicantView }).user.role).toBe('mentor');
  });

  it('rejecting keeps the mentor signed out with a clear reason', async () => {
    await asAdmin('post', `/api/admin/mentor-applications/${applicantId}/reject`).expect(200);

    const response = await login('dev@example.com').expect(403);
    expect((response.body as { code: string }).code).toBe('ACCOUNT_REJECTED');
  });

  it('refuses to decide an application twice', async () => {
    await asAdmin('post', `/api/admin/mentor-applications/${applicantId}/approve`).expect(200);
    await asAdmin('post', `/api/admin/mentor-applications/${applicantId}/reject`).expect(409);
  });

  it('returns 404 for unknown users and 400 for malformed ids', async () => {
    const unknownId = new Types.ObjectId().toHexString();
    await asAdmin('post', `/api/admin/mentor-applications/${unknownId}/approve`).expect(404);
    await asAdmin('post', '/api/admin/mentor-applications/not-an-id/approve').expect(400);
  });
});
