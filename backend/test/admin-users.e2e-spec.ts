import {
  asUser,
  clearDatabase,
  createTestApp,
  insertUser,
  refreshCookieFrom,
  SignedInUser,
  signedInUser,
  TEST_PASSWORD,
  TestApp,
} from './utils/test-app';

interface UserBody {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

describe('Admin user management (e2e)', () => {
  let t: TestApp;
  let admin: SignedInUser;
  let mentee: SignedInUser;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await clearDatabase(t.connection);
    admin = await signedInUser(t, {
      name: 'Ananya Admin',
      email: 'admin@example.com',
      role: 'admin',
    });
    mentee = await signedInUser(t, {
      name: 'Rahul Verma',
      email: 'rahul@example.com',
      role: 'mentee',
    });
    await insertUser(t, { name: 'Priya Sharma', email: 'priya@example.com', role: 'mentor' });
  });

  afterAll(async () => {
    await t.close();
  });

  const adminApi = () => asUser(t, admin.token);

  it('lists, searches and filters users', async () => {
    const all = (await adminApi().get('/api/admin/users').expect(200)).body as UserBody[];
    expect(all.map((u) => u.name)).toEqual(['Ananya Admin', 'Priya Sharma', 'Rahul Verma']);

    const byName = (await adminApi().get('/api/admin/users?q=PRIYA').expect(200))
      .body as UserBody[];
    expect(byName.map((u) => u.email)).toEqual(['priya@example.com']);

    const mentees = (await adminApi().get('/api/admin/users?role=mentee').expect(200))
      .body as UserBody[];
    expect(mentees.map((u) => u.name)).toEqual(['Rahul Verma']);

    const special = await adminApi().get('/api/admin/users?q=(').expect(200);
    expect(special.body).toEqual([]);
  });

  it('is admin-only', async () => {
    await asUser(t, mentee.token).get('/api/admin/users').expect(403);
    await asUser(t, mentee.token)
      .patch(`/api/admin/users/${mentee.id}`, { role: 'mentor' })
      .expect(403);
  });

  it('deactivating ends sessions immediately; reactivating restores access', async () => {
    const login = () =>
      t
        .http()
        .post('/api/auth/login')
        .send({ email: 'rahul@example.com', password: TEST_PASSWORD });
    const refreshCookie = refreshCookieFrom(await login().expect(200));

    await adminApi().patch(`/api/admin/users/${mentee.id}`, { status: 'deactivated' }).expect(200);

    await asUser(t, mentee.token).get('/api/auth/me').expect(401);
    await t
      .http()
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refreshCookie}`)
      .expect(401);
    expect(((await login().expect(403)).body as { code: string }).code).toBe('ACCOUNT_DEACTIVATED');

    await adminApi().patch(`/api/admin/users/${mentee.id}`, { status: 'active' }).expect(200);
    await login().expect(200);
  });

  it('changes a mentee into a mentor', async () => {
    const response = await adminApi()
      .patch(`/api/admin/users/${mentee.id}`, { role: 'mentor' })
      .expect(200);
    expect((response.body as UserBody).role).toBe('mentor');
  });

  it('protects admin accounts and pending applications', async () => {
    await adminApi().patch(`/api/admin/users/${admin.id}`, { status: 'deactivated' }).expect(403);

    const pending = await insertUser(t, {
      name: 'Pending Mentor',
      email: 'pending@example.com',
      role: 'mentor',
      status: 'pending_approval',
    });
    await adminApi()
      .patch(`/api/admin/users/${pending._id.toHexString()}`, { status: 'active' })
      .expect(409);
  });

  it('validates changes', async () => {
    await adminApi().patch(`/api/admin/users/${mentee.id}`, {}).expect(400);
    await adminApi().patch(`/api/admin/users/${mentee.id}`, { role: 'admin' }).expect(400);
    await adminApi().patch(`/api/admin/users/${mentee.id}`, { status: 'rejected' }).expect(400);
  });
});
