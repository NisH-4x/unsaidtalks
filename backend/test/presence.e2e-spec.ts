import { Socket } from 'socket.io-client';
import { connectSocket, emitWithAck, expectNoEvent, nextEvent } from './utils/sockets';
import {
  asUser,
  clearDatabase,
  createTestApp,
  SignedInUser,
  signedInUser,
  TestApp,
} from './utils/test-app';

interface PresenceUpdate {
  userId: string;
  online: boolean;
  lastSeenAt?: string;
}

interface TypingEvent {
  conversationId: string;
  userId: string;
  name: string;
  isTyping: boolean;
}

describe('Presence and typing (e2e)', () => {
  let t: TestApp;
  let mentor: SignedInUser;
  let rahul: SignedInUser;
  let sneha: SignedInUser;
  let groupId: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await createTestApp({ listen: true });
  });

  beforeEach(async () => {
    await clearDatabase(t.connection);
    const admin = await signedInUser(t, {
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
    const group = await asUser(t, admin.token)
      .post('/api/admin/groups', { name: 'TCS NQT Prep', memberIds: [mentor.id, rahul.id] })
      .expect(201);
    groupId = (group.body as { id: string }).id;
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.close());
  });

  afterAll(async () => {
    await t.close();
  });

  async function connect(user: SignedInUser): Promise<Socket> {
    const socket = await connectSocket(t.url, user.token);
    sockets.push(socket);
    return socket;
  }

  function closeSocket(socket: Socket) {
    socket.close();
    sockets.splice(sockets.indexOf(socket), 1);
  }

  it('tells people who share a conversation when someone comes online', async () => {
    const mentorSocket = await connect(mentor);
    const snehaSocket = await connect(sneha);
    const mentorHears = nextEvent<PresenceUpdate>(mentorSocket, 'presence:update');
    const outsiderHearsNothing = expectNoEvent(snehaSocket, 'presence:update');

    const rahulSocket = await connect(rahul);

    expect(await mentorHears).toEqual({ userId: rahul.id, online: true });
    await outsiderHearsNothing;

    const rahulView = await emitWithAck<{ ok: true; online: string[] }>(
      rahulSocket,
      'presence:sync',
      {},
    );
    expect(rahulView.online).toEqual([mentor.id]);
    const snehaView = await emitWithAck<{ ok: true; online: string[] }>(
      snehaSocket,
      'presence:sync',
      {},
    );
    expect(snehaView.online).toEqual([]);
  });

  it('marks someone offline with a last-seen time only when their last tab closes', async () => {
    const mentorSocket = await connect(mentor);
    const firstTab = await connect(rahul);
    const secondTab = await connect(rahul);

    const noOfflineYet = expectNoEvent(mentorSocket, 'presence:update');
    closeSocket(firstTab);
    await noOfflineYet;

    const wentOffline = nextEvent<PresenceUpdate>(mentorSocket, 'presence:update');
    closeSocket(secondTab);
    const update = await wentOffline;

    expect(update).toMatchObject({ userId: rahul.id, online: false });
    expect(new Date(update.lastSeenAt ?? 0).getTime()).toBeGreaterThan(Date.now() - 10_000);

    const details = await asUser(t, mentor.token).get(`/api/conversations/${groupId}`).expect(200);
    const members = (details.body as { members: Array<{ id: string; lastSeenAt: string | null }> })
      .members;
    expect(members.find((m) => m.id === rahul.id)?.lastSeenAt).toBe(update.lastSeenAt);
  });

  it('relays typing to the other members of the conversation only', async () => {
    const [mentorSocket, rahulSocket, snehaSocket] = await Promise.all(
      [mentor, rahul, sneha].map(connect),
    );
    const mentorSeesTyping = nextEvent<TypingEvent>(mentorSocket, 'typing');
    const typistSeesNothing = expectNoEvent(rahulSocket, 'typing');
    const outsiderSeesNothing = expectNoEvent(snehaSocket, 'typing');

    rahulSocket.emit('typing:start', { conversationId: groupId });

    expect(await mentorSeesTyping).toEqual({
      conversationId: groupId,
      userId: rahul.id,
      name: 'Rahul Mentee',
      isTyping: true,
    });
    await typistSeesNothing;
    await outsiderSeesNothing;

    const mentorSeesStop = nextEvent<TypingEvent>(mentorSocket, 'typing');
    rahulSocket.emit('typing:stop', { conversationId: groupId });
    expect((await mentorSeesStop).isTyping).toBe(false);
  });

  it('ignores typing for conversations the sender is not part of', async () => {
    const [mentorSocket, snehaSocket] = await Promise.all([connect(mentor), connect(sneha)]);
    const nothing = expectNoEvent(mentorSocket, 'typing');

    snehaSocket.emit('typing:start', { conversationId: groupId });
    snehaSocket.emit('typing:start', { conversationId: 'not-an-id' });

    await nothing;
  });
});
