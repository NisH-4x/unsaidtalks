import { Types } from 'mongoose';
import { Socket } from 'socket.io-client';
import { connectSocket, emitWithAck, nextEvent } from './utils/sockets';
import {
  asUser,
  clearDatabase,
  createTestApp,
  insertUser,
  SignedInUser,
  signedInUser,
  TestApp,
} from './utils/test-app';

interface Opened {
  conversationId: string;
  created: boolean;
}

interface Contact {
  id: string;
  name: string;
  role: string;
  conversationId: string | null;
}

type SendAck = { ok: true; message: { id: string } } | { ok: false; error: string };

describe('One-to-one chats (e2e)', () => {
  let t: TestApp;
  let admin: SignedInUser;
  let priya: SignedInUser;
  let arjun: SignedInUser;
  let rahul: SignedInUser;
  let sneha: SignedInUser;
  let kavya: SignedInUser;
  let groupId: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await createTestApp({ listen: true });
  });

  beforeEach(async () => {
    await clearDatabase(t.connection);
    admin = await signedInUser(t, {
      name: 'Ananya Admin',
      email: 'admin@example.com',
      role: 'admin',
    });
    priya = await signedInUser(t, {
      name: 'Priya Mentor',
      email: 'priya@example.com',
      role: 'mentor',
    });
    arjun = await signedInUser(t, {
      name: 'Arjun Mentor',
      email: 'arjun@example.com',
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
    kavya = await signedInUser(t, {
      name: 'Kavya Outsider',
      email: 'kavya@example.com',
      role: 'mentor',
    });
    const group = await asUser(t, admin.token)
      .post('/api/admin/groups', {
        name: 'TCS NQT Prep',
        memberIds: [priya.id, arjun.id, rahul.id, sneha.id],
      })
      .expect(201);
    groupId = (group.body as { id: string }).id;
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.close());
  });

  afterAll(async () => {
    await t.close();
  });

  const open = (from: SignedInUser, to: string) =>
    asUser(t, from.token).post('/api/direct-chats', { userId: to });

  async function connect(user: SignedInUser): Promise<Socket> {
    const socket = await connectSocket(t.url, user.token);
    sockets.push(socket);
    return socket;
  }

  async function chatIds(user: SignedInUser): Promise<string[]> {
    const response = await asUser(t, user.token).get('/api/conversations').expect(200);
    return (response.body as Array<{ id: string }>).map((chat) => chat.id);
  }

  it('lets a mentee start a chat with a mentor of their group, once', async () => {
    const first = (await open(rahul, priya.id).expect(201)).body as Opened;
    const again = (await open(rahul, priya.id).expect(200)).body as Opened;
    const fromMentor = (await open(priya, rahul.id).expect(200)).body as Opened;

    expect(first.created).toBe(true);
    expect(again).toEqual({ conversationId: first.conversationId, created: false });
    expect(fromMentor.conversationId).toBe(first.conversationId);
  });

  it('shows the chat to the other person when the first message arrives, live', async () => {
    const priyaSocket = await connect(priya);
    const rahulSocket = await connect(rahul);
    const { conversationId } = (await open(rahul, priya.id).expect(201)).body as Opened;

    expect(await chatIds(rahul)).toContain(conversationId);
    expect(await chatIds(priya)).not.toContain(conversationId);

    const delivered = nextEvent<{ message: { conversationId: string } }>(
      priyaSocket,
      'message:new',
    );
    const ack = await emitWithAck<SendAck>(rahulSocket, 'message:send', {
      conversationId,
      text: 'Hi ma’am, can I ask about my mock score?',
      clientId: 'first',
    });

    expect(ack.ok).toBe(true);
    expect((await delivered).message.conversationId).toBe(conversationId);
    const priyaList = (await asUser(t, priya.token).get('/api/conversations').expect(200))
      .body as Array<{
      id: string;
      title: string;
      unreadCount: number;
    }>;
    expect(priyaList.find((chat) => chat.id === conversationId)).toMatchObject({
      title: 'Rahul Mentee',
      unreadCount: 1,
    });
  });

  it('refuses chats with outsiders, yourself, admins and unknown people', async () => {
    const deactivated = await insertUser(t, {
      name: 'Gone Mentor',
      email: 'gone@example.com',
      role: 'mentor',
      status: 'deactivated',
    });

    const outsider = await open(rahul, kavya.id).expect(403);
    expect((outsider.body as { message: string }).message).toBe(
      'You can only message people from your program groups.',
    );
    await open(rahul, rahul.id).expect(400);
    await open(rahul, admin.id).expect(403);
    await open(rahul, new Types.ObjectId().toHexString()).expect(404);
    await open(rahul, deactivated._id.toHexString()).expect(404);
    await open(rahul, 'not-an-id').expect(400);
  });

  it('lets mentees message each other only where the group allows it', async () => {
    const refused = await open(rahul, sneha.id).expect(403);
    expect((refused.body as { message: string }).message).toContain(
      'Mentees can message each other',
    );

    await asUser(t, admin.token)
      .patch(`/api/admin/groups/${groupId}`, { allowMenteeDirectChat: true })
      .expect(200);

    await open(rahul, sneha.id).expect(201);
  });

  it('lets mentors message mentees and co-mentors, and admins message anyone', async () => {
    await open(priya, sneha.id).expect(201);
    await open(priya, arjun.id).expect(201);
    await open(admin, kavya.id).expect(201);
  });

  it('lists only the people you may message, without contact details', async () => {
    const { conversationId } = (await open(rahul, priya.id).expect(201)).body as Opened;

    const response = await asUser(t, rahul.token).get('/api/direct-chats/contacts').expect(200);
    const contacts = response.body as Contact[];

    expect(contacts.map((c) => c.name)).toEqual(['Arjun Mentor', 'Priya Mentor']);
    expect(contacts.find((c) => c.name === 'Priya Mentor')?.conversationId).toBe(conversationId);
    expect(contacts.find((c) => c.name === 'Arjun Mentor')?.conversationId).toBeNull();
    expect(JSON.stringify(contacts)).not.toContain('@example.com');

    const searched = await asUser(t, rahul.token)
      .get('/api/direct-chats/contacts?q=pri')
      .expect(200);
    expect((searched.body as Contact[]).map((c) => c.name)).toEqual(['Priya Mentor']);

    await asUser(t, admin.token)
      .patch(`/api/admin/groups/${groupId}`, { allowMenteeDirectChat: true })
      .expect(200);
    const withMentees = await asUser(t, rahul.token).get('/api/direct-chats/contacts').expect(200);
    expect((withMentees.body as Contact[]).map((c) => c.name)).toEqual([
      'Arjun Mentor',
      'Priya Mentor',
      'Sneha Mentee',
    ]);
  });

  it('makes a chat read-only once the two people no longer share a group', async () => {
    const { conversationId } = (await open(rahul, priya.id).expect(201)).body as Opened;
    const before = await asUser(t, rahul.token)
      .get(`/api/conversations/${conversationId}`)
      .expect(200);
    expect((before.body as { canSend: boolean }).canSend).toBe(true);

    await asUser(t, admin.token)
      .delete(`/api/admin/groups/${groupId}/members/${rahul.id}`)
      .expect(200);

    for (const user of [rahul, priya]) {
      const details = await asUser(t, user.token)
        .get(`/api/conversations/${conversationId}`)
        .expect(200);
      expect((details.body as { canSend: boolean }).canSend).toBe(false);

      const socket = await connect(user);
      const ack = await emitWithAck<SendAck>(socket, 'message:send', {
        conversationId,
        text: 'Still there?',
        clientId: `after-removal-${user.id}`,
      });
      expect(ack).toEqual({
        ok: false,
        error: 'You can no longer send messages here because you no longer share a program group.',
      });
    }
  });
});
