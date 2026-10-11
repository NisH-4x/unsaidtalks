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

interface MessageBody {
  id: string;
  reactions: Array<{ emoji: string; userIds: string[] }>;
}

type SendAck = { ok: true; message: MessageBody } | { ok: false; error: string };

describe('Read receipts and reactions (e2e)', () => {
  let t: TestApp;
  let admin: SignedInUser;
  let mentor: SignedInUser;
  let rahul: SignedInUser;
  let outsider: SignedInUser;
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
    outsider = await signedInUser(t, {
      name: 'Other Mentee',
      email: 'other@example.com',
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

  async function connect(user: SignedInUser) {
    const socket = await connectSocket(t.url, user.token);
    sockets.push(socket);
    return socket;
  }

  let draft = 0;
  async function sent(user: SignedInUser, text: string, conversationId = groupId) {
    draft += 1;
    const ack = await emitWithAck<SendAck>(await connect(user), 'message:send', {
      conversationId,
      text,
      clientId: `draft-${draft}`,
    });
    if (!ack.ok) throw new Error(ack.error);
    return ack.message;
  }

  const reactionPath = (messageId: string, emoji: string) =>
    `/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`;
  const react = (user: SignedInUser, messageId: string, emoji: string) =>
    t.http().put(reactionPath(messageId, emoji)).set('Authorization', `Bearer ${user.token}`);
  const unreact = (user: SignedInUser, messageId: string, emoji: string) =>
    asUser(t, user.token).delete(reactionPath(messageId, emoji));

  describe('read receipts', () => {
    it('tells the other members live how far someone has read, and remembers it', async () => {
      const message = await sent(mentor, 'Homework: 15 questions on percentages');
      const watcher = await connect(mentor);
      const receipt = nextEvent<{
        conversationId: string;
        userId: string;
        lastReadMessageId: string;
      }>(watcher, 'receipt:updated');

      await asUser(t, rahul.token).post(`/api/conversations/${groupId}/read`).expect(204);

      expect(await receipt).toEqual({
        conversationId: groupId,
        userId: rahul.id,
        lastReadMessageId: message.id,
      });
      const details = await asUser(t, mentor.token)
        .get(`/api/conversations/${groupId}`)
        .expect(200);
      const members = (
        details.body as { members: Array<{ id: string; lastReadMessageId: string }> }
      ).members;
      expect(members.find((m) => m.id === rahul.id)?.lastReadMessageId).toBe(message.id);
    });
  });

  describe('reactions', () => {
    it('adds each person’s reaction once, live for everyone, and removes it again', async () => {
      const message = await sent(rahul, 'Cleared the TCS mock with 84%!');
      const watcher = await connect(rahul);
      const updated = nextEvent<{ message: MessageBody }>(watcher, 'message:updated');

      const first = await react(mentor, message.id, '🎉').expect(200);
      expect((first.body as MessageBody).reactions).toEqual([
        { emoji: '🎉', userIds: [mentor.id] },
      ]);
      expect((await updated).message.reactions).toEqual([{ emoji: '🎉', userIds: [mentor.id] }]);

      const repeat = react(mentor, message.id, '🎉').expect(200);
      await expectNoEvent(watcher, 'message:updated');
      expect(((await repeat).body as MessageBody).reactions).toEqual([
        { emoji: '🎉', userIds: [mentor.id] },
      ]);

      await react(rahul, message.id, '🎉').expect(200);
      await react(mentor, message.id, '👍').expect(200);
      const afterRemoval = await unreact(mentor, message.id, '🎉').expect(200);
      expect((afterRemoval.body as MessageBody).reactions).toEqual([
        { emoji: '👍', userIds: [mentor.id] },
        { emoji: '🎉', userIds: [rahul.id] },
      ]);
    });

    it('accepts only the available emojis, from people who can post in the conversation', async () => {
      const message = await sent(rahul, 'Hello');

      const pizza = await react(mentor, message.id, '🍕').expect(400);
      expect((pizza.body as { message: string }).message).toBe(
        'Choose one of the available reactions',
      );
      await react(outsider, message.id, '👍').expect(404);
    });

    it('clears reactions when a message is deleted and refuses new ones', async () => {
      const message = await sent(rahul, 'Wrong group');
      await react(mentor, message.id, '😮').expect(200);

      const deleted = await asUser(t, rahul.token)
        .delete(`/api/messages/${message.id}`)
        .expect(200);
      expect((deleted.body as MessageBody).reactions).toEqual([]);
      await react(mentor, message.id, '👍').expect(400);
    });

    it('refuses reactions in a private chat that has become read-only', async () => {
      const chat = await asUser(t, rahul.token)
        .post('/api/direct-chats', { userId: mentor.id })
        .expect(201);
      const conversationId = (chat.body as { conversationId: string }).conversationId;
      const message = await sent(rahul, 'Thanks for the mock review', conversationId);

      await asUser(t, admin.token)
        .delete(`/api/admin/groups/${groupId}/members/${rahul.id}`)
        .expect(200);
      await react(mentor, message.id, '👍').expect(403);
    });
  });
});
