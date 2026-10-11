import { Types } from 'mongoose';
import { Socket } from 'socket.io-client';
import { connectSocket, emitWithAck, nextEvent } from './utils/sockets';
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
  text: string;
  isAnnouncement: boolean;
  pin: { pinnedBy: string } | null;
  doubt: { status: string; resolvedBy: string | null } | null;
  replyTo: { messageId: string; senderName: string; preview: string } | null;
}

type SendAck = { ok: true; message: MessageBody } | { ok: false; error: string };

describe('Mentor tools (e2e)', () => {
  let t: TestApp;
  let admin: SignedInUser;
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
    const group = await asUser(t, admin.token)
      .post('/api/admin/groups', {
        name: 'TCS NQT Prep',
        memberIds: [mentor.id, rahul.id, sneha.id],
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

  async function connect(user: SignedInUser): Promise<Socket> {
    const socket = await connectSocket(t.url, user.token);
    sockets.push(socket);
    return socket;
  }

  let draft = 0;
  async function send(user: SignedInUser, text: string, options: Record<string, unknown> = {}) {
    const socket = await connect(user);
    draft += 1;
    return emitWithAck<SendAck>(socket, 'message:send', {
      conversationId: groupId,
      text,
      clientId: `draft-${draft}`,
      ...options,
    });
  }

  async function sent(user: SignedInUser, text: string, options: Record<string, unknown> = {}) {
    const ack = await send(user, text, options);
    if (!ack.ok) throw new Error(ack.error);
    return ack.message;
  }

  describe('announcements', () => {
    it('lets mentors post announcements and lists them for members', async () => {
      const announcement = await sent(mentor, 'Mock test on Saturday at 10 AM', {
        isAnnouncement: true,
      });
      await sent(mentor, 'Regular message');

      expect(announcement.isAnnouncement).toBe(true);
      const list = await asUser(t, rahul.token)
        .get(`/api/conversations/${groupId}/announcements`)
        .expect(200);
      expect((list.body as MessageBody[]).map((m) => m.text)).toEqual([
        'Mock test on Saturday at 10 AM',
      ]);
    });

    it('refuses announcements from mentees and in private chats', async () => {
      expect(await send(rahul, 'Listen up!', { isAnnouncement: true })).toEqual({
        ok: false,
        error: 'Only mentors and admins can post announcements in a group',
      });

      const chat = await asUser(t, rahul.token)
        .post('/api/direct-chats', { userId: mentor.id })
        .expect(201);
      const socket = await connect(mentor);
      const ack = await emitWithAck<SendAck>(socket, 'message:send', {
        conversationId: (chat.body as { conversationId: string }).conversationId,
        text: 'Private announcement',
        clientId: 'private-announcement',
        isAnnouncement: true,
      });
      expect(ack.ok).toBe(false);
    });
  });

  describe('pins', () => {
    it('lets mentors pin and unpin, broadcasting the change live', async () => {
      const message = await sent(mentor, 'Formula sheet: https://example.com/formulas');
      const rahulSocket = await connect(rahul);
      const pinnedLive = nextEvent<{ message: MessageBody }>(rahulSocket, 'message:updated');

      const pinned = await asUser(t, mentor.token)
        .post(`/api/messages/${message.id}/pin`)
        .expect(200);

      expect((pinned.body as MessageBody).pin?.pinnedBy).toBe(mentor.id);
      expect((await pinnedLive).message.pin).not.toBeNull();
      const pins = await asUser(t, rahul.token)
        .get(`/api/conversations/${groupId}/pins`)
        .expect(200);
      expect((pins.body as MessageBody[]).map((m) => m.id)).toEqual([message.id]);

      const unpinned = await asUser(t, mentor.token)
        .delete(`/api/messages/${message.id}/pin`)
        .expect(200);
      expect((unpinned.body as MessageBody).pin).toBeNull();
    });

    it('refuses pins from mentees and limits a group to five', async () => {
      const message = await sent(rahul, 'Pin me please');
      await asUser(t, rahul.token).post(`/api/messages/${message.id}/pin`).expect(403);

      for (let index = 0; index < 5; index += 1) {
        const toPin = await sent(mentor, `Resource ${index}`);
        await asUser(t, mentor.token).post(`/api/messages/${toPin.id}/pin`).expect(200);
      }
      const sixth = await sent(mentor, 'One too many');
      const refused = await asUser(t, mentor.token)
        .post(`/api/messages/${sixth.id}/pin`)
        .expect(409);
      expect((refused.body as { message: string }).message).toContain('at most 5');
    });
  });

  describe('doubts', () => {
    it('follows a doubt from a mentee question to a mentor resolution', async () => {
      const asked = await sent(rahul, 'Why is the answer 14⅓ days?', { isDoubt: true });
      expect(asked.doubt).toMatchObject({ status: 'open', resolvedBy: null });

      const open = await asUser(t, mentor.token)
        .get(`/api/conversations/${groupId}/doubts?status=open`)
        .expect(200);
      expect((open.body as MessageBody[]).map((m) => m.id)).toEqual([asked.id]);

      const rahulSocket = await connect(rahul);
      const resolvedLive = nextEvent<{ message: MessageBody }>(rahulSocket, 'message:updated');
      const resolved = await asUser(t, mentor.token)
        .patch(`/api/messages/${asked.id}/doubt`, { status: 'resolved' })
        .expect(200);

      expect((resolved.body as MessageBody).doubt).toMatchObject({
        status: 'resolved',
        resolvedBy: mentor.id,
      });
      expect((await resolvedLive).message.doubt?.status).toBe('resolved');
      const stillOpen = await asUser(t, mentor.token)
        .get(`/api/conversations/${groupId}/doubts?status=open`)
        .expect(200);
      expect(stillOpen.body).toEqual([]);

      await asUser(t, mentor.token)
        .patch(`/api/messages/${asked.id}/doubt`, { status: 'open' })
        .expect(200);
    });

    it('lets a mentee mark and unmark only their own messages', async () => {
      const own = await sent(rahul, 'Is percentage 30% of quant?');
      const someoneElses = await sent(sneha, 'My question');

      await asUser(t, rahul.token).post(`/api/messages/${own.id}/doubt`).expect(200);
      await asUser(t, rahul.token).post(`/api/messages/${someoneElses.id}/doubt`).expect(403);
      await asUser(t, rahul.token).delete(`/api/messages/${own.id}/doubt`).expect(200);
    });

    it('keeps doubt powers with the right roles', async () => {
      expect(await send(mentor, 'Mentor doubt', { isDoubt: true })).toMatchObject({ ok: false });
      const asked = await sent(rahul, 'Question', { isDoubt: true });

      await asUser(t, sneha.token)
        .patch(`/api/messages/${asked.id}/doubt`, { status: 'resolved' })
        .expect(403);
      await asUser(t, admin.token)
        .patch(`/api/messages/${asked.id}/doubt`, { status: 'resolved' })
        .expect(200);
      await asUser(t, rahul.token).delete(`/api/messages/${asked.id}/doubt`).expect(409);
      expect(await send(rahul, 'Both?', { isDoubt: true, isAnnouncement: true })).toMatchObject({
        ok: false,
      });
    });
  });

  describe('replies', () => {
    it('stores a quote of the original message', async () => {
      const original = await sent(mentor, 'Revise time and work tonight');

      const reply = await sent(rahul, 'Will do!', { replyToId: original.id });

      expect(reply.replyTo).toEqual({
        messageId: original.id,
        senderName: 'Priya Mentor',
        type: 'text',
        preview: 'Revise time and work tonight',
        isDeleted: false,
      });
    });

    it('refuses replies to messages from other conversations', async () => {
      expect(
        await send(rahul, 'Reply to nothing', { replyToId: new Types.ObjectId().toHexString() }),
      ).toEqual({ ok: false, error: 'You can only reply to a message in this conversation' });
    });
  });

  it('hides messages of conversations the user cannot see', async () => {
    const outsider = await signedInUser(t, {
      name: 'Kavya Outsider',
      email: 'kavya@example.com',
      role: 'mentor',
    });
    const message = await sent(mentor, 'Members only');

    await asUser(t, outsider.token).post(`/api/messages/${message.id}/pin`).expect(404);
    await asUser(t, outsider.token).get(`/api/conversations/${groupId}/doubts`).expect(404);
  });
});
