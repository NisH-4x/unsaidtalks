import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  directKeyFor,
} from '../src/modules/conversations/schemas/conversation.schema';
import { Membership } from '../src/modules/conversations/schemas/membership.schema';
import {
  asUser,
  clearDatabase,
  createTestApp,
  SignedInUser,
  signedInUser,
  TestApp,
} from './utils/test-app';

interface ListItem {
  id: string;
  type: string;
  title: string;
  unreadCount: number;
  otherUser?: Record<string, unknown>;
  lastMessage: { preview: string } | null;
}

interface DetailsBody {
  access: string;
  members: Array<Record<string, unknown>>;
}

describe('Conversations visibility (e2e)', () => {
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

  async function createGroup(name: string, memberIds: string[]): Promise<string> {
    const response = await asUser(t, admin.token)
      .post('/api/admin/groups', { name, memberIds })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  async function createDirectChat(a: SignedInUser, b: SignedInUser): Promise<string> {
    const conversations = t.app.get<Model<Conversation>>(getModelToken(Conversation.name));
    const memberships = t.app.get<Model<Membership>>(getModelToken(Membership.name));
    const chat = await conversations.create({
      type: 'direct',
      participantIds: [a.user._id, b.user._id],
      directKey: directKeyFor(a.user._id, b.user._id),
      createdBy: a.user._id,
    });
    await memberships.insertMany([
      { conversationId: chat._id, userId: a.user._id },
      { conversationId: chat._id, userId: b.user._id },
    ]);
    return chat._id.toHexString();
  }

  it('shows each user only their own groups and chats', async () => {
    const groupA = await createGroup('Group A', [mentor.id, rahul.id]);
    const groupB = await createGroup('Group B', [sneha.id]);
    const direct = await createDirectChat(rahul, mentor);

    const rahulList = (await asUser(t, rahul.token).get('/api/conversations').expect(200))
      .body as ListItem[];
    const snehaList = (await asUser(t, sneha.token).get('/api/conversations').expect(200))
      .body as ListItem[];

    expect(rahulList.map((c) => c.id).sort()).toEqual([groupA, direct].sort());
    expect(snehaList.map((c) => c.id)).toEqual([groupB]);
  });

  it('answers 404 for conversations the user does not belong to', async () => {
    const groupA = await createGroup('Group A', [mentor.id, rahul.id]);
    const direct = await createDirectChat(rahul, mentor);

    await asUser(t, sneha.token).get(`/api/conversations/${groupA}`).expect(404);
    await asUser(t, sneha.token).get(`/api/conversations/${direct}`).expect(404);
    await asUser(t, sneha.token)
      .get(`/api/conversations/${new Types.ObjectId().toHexString()}`)
      .expect(404);
    await asUser(t, sneha.token).get('/api/conversations/not-an-id').expect(400);
  });

  it('shows members only public profile fields', async () => {
    const groupA = await createGroup('Group A', [mentor.id, rahul.id]);

    const response = await asUser(t, rahul.token).get(`/api/conversations/${groupA}`).expect(200);
    const details = response.body as DetailsBody;

    expect(details.access).toBe('member');
    expect(details.members).toHaveLength(2);
    for (const member of details.members) {
      expect(Object.keys(member).sort()).toEqual([
        'id',
        'joinedAt',
        'lastReadMessageId',
        'lastSeenAt',
        'name',
        'role',
      ]);
    }
    expect(JSON.stringify(response.body)).not.toContain('@example.com');
  });

  it('lets admins open any group as moderators but never private chats', async () => {
    const groupA = await createGroup('Group A', [mentor.id, rahul.id]);
    const direct = await createDirectChat(rahul, mentor);

    const group = await asUser(t, admin.token).get(`/api/conversations/${groupA}`).expect(200);
    expect((group.body as DetailsBody).access).toBe('moderator');

    await asUser(t, admin.token).get(`/api/conversations/${direct}`).expect(404);
    await asUser(t, mentor.token).get(`/api/conversations/${direct}`).expect(200);
  });

  it('titles a direct chat with the other person and hides their contact details', async () => {
    await createDirectChat(rahul, mentor);

    const list = (await asUser(t, rahul.token).get('/api/conversations').expect(200))
      .body as ListItem[];

    expect(list[0]).toMatchObject({ type: 'direct', title: 'Priya Mentor' });
    expect(list[0].otherUser).toEqual({
      id: mentor.id,
      name: 'Priya Mentor',
      role: 'mentor',
      lastSeenAt: null,
    });
  });

  it('gives a late joiner the full conversation with nothing unread', async () => {
    const groupA = await createGroup('Group A', [mentor.id]);

    await asUser(t, admin.token)
      .post(`/api/admin/groups/${groupA}/members`, { userIds: [rahul.id] })
      .expect(201);

    const list = (await asUser(t, rahul.token).get('/api/conversations').expect(200))
      .body as ListItem[];
    expect(list[0]).toMatchObject({
      id: groupA,
      unreadCount: 0,
      lastMessage: expect.objectContaining({
        preview: 'Ananya Admin added Rahul Mentee',
      }) as ListItem['lastMessage'],
    });
  });
});
