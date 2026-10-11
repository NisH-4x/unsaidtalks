import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from '../src/modules/messages/schemas/message.schema';
import {
  asUser,
  clearDatabase,
  createTestApp,
  insertUser,
  SignedInUser,
  signedInUser,
  TestApp,
} from './utils/test-app';

interface GroupBody {
  id: string;
  name: string;
  allowMenteeDirectChat: boolean;
  memberCount: number;
  mentorCount: number;
  menteeCount: number;
  members: Array<{ id: string; email: string; role: string }>;
}

interface ChatListBody {
  id: string;
  title: string;
  unreadCount: number;
  memberCount: number;
  lastMessage: { preview: string; type: string } | null;
}

describe('Group management (e2e)', () => {
  let t: TestApp;
  let admin: SignedInUser;
  let mentor: SignedInUser;
  let rahul: SignedInUser;
  let sneha: SignedInUser;

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
    mentor = await signedInUser(t, {
      name: 'Priya Mentor',
      email: 'priya@example.com',
      role: 'mentor',
    });
    rahul = await signedInUser(t, {
      name: 'Rahul Mentee',
      email: 'rahul@example.com',
      role: 'mentee',
    });
    sneha = await signedInUser(t, {
      name: 'Sneha Mentee',
      email: 'sneha@example.com',
      role: 'mentee',
    });
  });

  afterAll(async () => {
    await t.close();
  });

  const messages = () => t.app.get<Model<Message>>(getModelToken(Message.name));

  async function createGroup(memberIds: string[], name = 'TCS NQT Prep – Batch 12') {
    const response = await asUser(t, admin.token)
      .post('/api/admin/groups', { name, program: 'TCS NQT Prep', batch: 'Batch 12', memberIds })
      .expect(201);
    return response.body as GroupBody;
  }

  it('creates a group with members and records it in the timeline', async () => {
    const group = await createGroup([mentor.id, rahul.id, sneha.id]);

    expect(group).toMatchObject({ memberCount: 3, mentorCount: 1, menteeCount: 2 });
    expect(group.allowMenteeDirectChat).toBe(false);
    expect(group.members.map((m) => m.role)).toEqual(['mentor', 'mentee', 'mentee']);

    const notes = await messages()
      .find({ conversationId: group.id }, { text: 1, type: 1 })
      .sort({ _id: 1 })
      .lean();
    expect(notes.map((note) => note.text)).toEqual([
      'Ananya Admin created this group',
      'Ananya Admin added Priya Mentor, Rahul Mentee and Sneha Mentee',
    ]);
    expect(notes.every((note) => note.type === 'system')).toBe(true);

    const list = await asUser(t, rahul.token).get('/api/conversations').expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({
        id: group.id,
        title: 'TCS NQT Prep – Batch 12',
        memberCount: 3,
        unreadCount: 0,
        lastMessage: expect.objectContaining({
          type: 'system',
          preview: 'Ananya Admin added Priya Mentor, Rahul Mentee and Sneha Mentee',
        }) as ChatListBody['lastMessage'],
      }) as ChatListBody,
    ]);
  });

  it('lists every group with member counts for admins', async () => {
    await createGroup([mentor.id, rahul.id], 'Group A');
    await createGroup([sneha.id], 'Group B');

    const response = await asUser(t, admin.token).get('/api/admin/groups').expect(200);
    const groups = response.body as GroupBody[];

    expect(groups.map((g) => g.name).sort()).toEqual(['Group A', 'Group B']);
    expect(groups.find((g) => g.name === 'Group A')).toMatchObject({
      memberCount: 2,
      mentorCount: 1,
      menteeCount: 1,
    });
  });

  it('refuses group management to mentors and mentees', async () => {
    for (const user of [mentor, rahul]) {
      await asUser(t, user.token).get('/api/admin/groups').expect(403);
      await asUser(t, user.token).post('/api/admin/groups', { name: 'Sneaky group' }).expect(403);
    }
  });

  it('only accepts active mentors and mentees as members', async () => {
    const pending = await insertUser(t, {
      name: 'Pending Mentor',
      email: 'pending@example.com',
      role: 'mentor',
      status: 'pending_approval',
    });
    const deactivated = await insertUser(t, {
      name: 'Gone Mentee',
      email: 'gone@example.com',
      role: 'mentee',
      status: 'deactivated',
    });
    const group = await createGroup([mentor.id]);
    const adminApi = asUser(t, admin.token);

    for (const id of [pending._id, deactivated._id, admin.user._id, new Types.ObjectId()]) {
      await adminApi
        .post(`/api/admin/groups/${group.id}/members`, { userIds: [id.toHexString()] })
        .expect(400);
    }
    await adminApi
      .post(`/api/admin/groups/${group.id}/members`, { userIds: ['not-an-id'] })
      .expect(400);
  });

  it('treats adding an existing member as a no-op', async () => {
    const group = await createGroup([mentor.id, rahul.id]);

    const response = await asUser(t, admin.token)
      .post(`/api/admin/groups/${group.id}/members`, { userIds: [rahul.id, sneha.id] })
      .expect(201);

    expect((response.body as GroupBody).memberCount).toBe(3);
    const lastNote = await messages()
      .findOne({ conversationId: group.id })
      .sort({ _id: -1 })
      .lean();
    expect(lastNote?.text).toBe('Ananya Admin added Sneha Mentee');
  });

  it('removing a member hides the group from them', async () => {
    const group = await createGroup([mentor.id, rahul.id]);

    await asUser(t, admin.token)
      .delete(`/api/admin/groups/${group.id}/members/${rahul.id}`)
      .expect(200);

    const list = await asUser(t, rahul.token).get('/api/conversations').expect(200);
    expect(list.body).toEqual([]);
    await asUser(t, rahul.token).get(`/api/conversations/${group.id}`).expect(404);
    await asUser(t, admin.token)
      .delete(`/api/admin/groups/${group.id}/members/${rahul.id}`)
      .expect(404);
  });

  it('updates group details and the mentee-to-mentee chat setting', async () => {
    const group = await createGroup([mentor.id]);

    const response = await asUser(t, admin.token)
      .patch(`/api/admin/groups/${group.id}`, {
        name: 'TCS NQT Prep – Batch 13',
        allowMenteeDirectChat: true,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      name: 'TCS NQT Prep – Batch 13',
      allowMenteeDirectChat: true,
    });
  });

  it('validates group input', async () => {
    const adminApi = asUser(t, admin.token);
    await adminApi.post('/api/admin/groups', { name: 'ab' }).expect(400);
    await adminApi.post('/api/admin/groups', { name: 'Valid name', color: 'red' }).expect(400);
    await adminApi.get(`/api/admin/groups/${new Types.ObjectId().toHexString()}`).expect(404);
  });
});
