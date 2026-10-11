import { Socket } from 'socket.io-client';
import { ATTACHMENTS_BUCKET } from '../src/modules/attachments/attachment-storage.service';
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
  isDeleted: boolean;
  removedByModerator: boolean;
  replyTo: { messageId: string; preview: string; isDeleted: boolean } | null;
}

interface ReportedMessage {
  messageId: string;
  status: string;
  conversation: { type: string; title: string };
  message: { senderName: string; text: string; isDeleted: boolean };
  reports: Array<{ reason: string; note: string; reportedBy: { name: string; email: string } }>;
  reviewedBy: { name: string } | null;
}

type SendAck = { ok: true; message: MessageBody } | { ok: false; error: string };

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Moderation (e2e)', () => {
  let t: TestApp;
  let admin: SignedInUser;
  let mentor: SignedInUser;
  let rahul: SignedInUser;
  let sneha: SignedInUser;
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
    sneha = await signedInUser(t, {
      name: 'Sneha Mentee',
      email: 'sneha@example.com',
      role: 'mentee',
    });
    outsider = await signedInUser(t, {
      name: 'Other Mentee',
      email: 'other@example.com',
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
  async function sent(
    user: SignedInUser,
    text: string,
    options: Record<string, unknown> = {},
  ): Promise<MessageBody> {
    draft += 1;
    const ack = await emitWithAck<SendAck>(await connect(user), 'message:send', {
      conversationId: groupId,
      text,
      clientId: `draft-${draft}`,
      ...options,
    });
    if (!ack.ok) throw new Error(ack.error);
    return ack.message;
  }

  const remove = (user: SignedInUser, messageId: string) =>
    asUser(t, user.token).delete(`/api/messages/${messageId}`);

  const report = (user: SignedInUser, messageId: string, body: object = { reason: 'abuse' }) =>
    asUser(t, user.token).post(`/api/messages/${messageId}/report`, body);

  async function history(user: SignedInUser, conversationId = groupId) {
    const page = await asUser(t, user.token)
      .get(`/api/conversations/${conversationId}/messages`)
      .expect(200);
    return (page.body as { messages: MessageBody[] }).messages;
  }

  async function chatFor(user: SignedInUser, conversationId = groupId) {
    const chats = await asUser(t, user.token).get('/api/conversations').expect(200);
    return (
      chats.body as Array<{
        id: string;
        unreadCount: number;
        lastMessage: { messageId: string; preview: string };
      }>
    ).find((chat) => chat.id === conversationId);
  }

  describe('deleting messages', () => {
    it('lets people delete their own message for everyone', async () => {
      const message = await sent(rahul, 'My number is 98765 43210');
      const watcher = await connect(sneha);
      const updated = nextEvent<{ message: MessageBody }>(watcher, 'message:updated');

      const response = await remove(rahul, message.id).expect(200);

      expect(response.body).toMatchObject({ isDeleted: true, text: '', removedByModerator: false });
      expect((await updated).message).toMatchObject({ id: message.id, isDeleted: true, text: '' });
      expect((await history(sneha)).at(-1)).toMatchObject({ id: message.id, isDeleted: true });
      expect((await chatFor(sneha))?.lastMessage).toMatchObject({
        messageId: message.id,
        preview: 'This message was deleted',
      });
    });

    it('takes a deleted message out of unread counts', async () => {
      const watcher = await connect(sneha);
      const message = await sent(rahul, 'Oops, wrong group');
      expect((await chatFor(sneha))?.unreadCount).toBe(1);

      const unread = nextEvent<{ conversationId: string; unreadCount: number }>(
        watcher,
        'conversation:unread',
      );
      await remove(rahul, message.id).expect(200);

      expect(await unread).toEqual({ conversationId: groupId, unreadCount: 0 });
      expect((await chatFor(sneha))?.unreadCount).toBe(0);
    });

    it('lets mentors and admins delete any group message, but not other mentees', async () => {
      const first = await sent(rahul, 'First');
      const second = await sent(rahul, 'Second');

      const refused = await remove(sneha, first.id).expect(403);
      expect((refused.body as { message: string }).message).toBe(
        "Only mentors and admins can delete other people's messages",
      );
      const byMentor = await remove(mentor, first.id).expect(200);
      expect(byMentor.body).toMatchObject({ isDeleted: true, removedByModerator: true });
      // The admin is not a member of this group, but moderates it.
      await remove(admin, second.id).expect(200);
      await remove(outsider, second.id).expect(404);
    });

    it("never deletes the other person's messages in a private chat", async () => {
      const chat = await asUser(t, rahul.token)
        .post('/api/direct-chats', { userId: mentor.id })
        .expect(201);
      const conversationId = (chat.body as { conversationId: string }).conversationId;
      const ack = await emitWithAck<SendAck>(await connect(rahul), 'message:send', {
        conversationId,
        text: 'Private question',
        clientId: 'private-1',
      });
      if (!ack.ok) throw new Error(ack.error);

      await remove(mentor, ack.message.id).expect(403);
      await remove(admin, ack.message.id).expect(404);
      await remove(rahul, ack.message.id).expect(200);
    });

    it('keeps replies but stops them quoting the deleted text', async () => {
      const original = await sent(rahul, 'Sharing my email: rahul@example.com');
      const reply = await sent(sneha, 'Thanks!', { replyToId: original.id });

      await remove(rahul, original.id).expect(200);

      const replyNow = (await history(mentor)).find((m) => m.id === reply.id);
      expect(replyNow?.replyTo).toMatchObject({ isDeleted: true, preview: '' });
    });

    it('refuses to delete system notes', async () => {
      const [note] = await history(admin);
      await remove(admin, note.id).expect(400);
    });

    it('removes the file of a deleted message unless it was reported', async () => {
      const upload = (clientId: string) =>
        t
          .http()
          .post(`/api/conversations/${groupId}/attachments`)
          .set('Authorization', `Bearer ${rahul.token}`)
          .field('clientId', clientId)
          .attach('file', PNG, { filename: 'photo.png', contentType: 'image/png' })
          .expect(201);
      const storedFiles = () =>
        t.connection.collection(`${ATTACHMENTS_BUCKET}.files`).countDocuments();

      const plain = (await upload('photo-1')).body as MessageBody;
      await remove(rahul, plain.id).expect(200);
      expect(await storedFiles()).toBe(0);

      const reported = (await upload('photo-2')).body as MessageBody;
      await report(sneha, reported.id).expect(201);
      await remove(rahul, reported.id).expect(200);
      expect(await storedFiles()).toBe(1);

      await asUser(t, admin.token).get(`/api/admin/reports/${reported.id}/attachment`).expect(200);
      await asUser(t, sneha.token).get(`/api/admin/reports/${reported.id}/attachment`).expect(403);
    });
  });

  describe('reporting messages', () => {
    it('accepts one report per person from anyone but the sender and admins', async () => {
      const message = await sent(rahul, 'Rude message');

      await report(sneha, message.id, { reason: 'abuse', note: 'Insulting another mentee' }).expect(
        201,
      );
      const again = await report(sneha, message.id).expect(409);
      expect((again.body as { message: string }).message).toBe(
        'You have already reported this message',
      );
      await report(rahul, message.id).expect(403);
      await report(admin, message.id).expect(403);
      await report(outsider, message.id).expect(404);
      await report(mentor, message.id, { reason: 'gossip' }).expect(400);
    });

    it('does not accept reports about deleted messages', async () => {
      const message = await sent(rahul, 'Gone soon');
      await remove(rahul, message.id).expect(200);
      await report(sneha, message.id).expect(400);
    });

    it('shows reports to admins only, grouped by message, with what was said', async () => {
      const message = await sent(rahul, 'Call me on 98765 43210');
      await report(sneha, message.id, { reason: 'personal_info', note: 'Phone number' });
      await report(mentor, message.id, { reason: 'personal_info' });

      await asUser(t, sneha.token).get('/api/admin/reports').expect(403);
      const list = await asUser(t, admin.token).get('/api/admin/reports').expect(200);
      const [reported] = list.body as ReportedMessage[];

      expect(list.body).toHaveLength(1);
      expect(reported).toMatchObject({
        messageId: message.id,
        status: 'open',
        conversation: { type: 'group', title: 'TCS NQT Prep' },
        message: { senderName: 'Rahul Mentee', text: 'Call me on 98765 43210', isDeleted: false },
      });
      expect(reported.reports.map((r) => r.reportedBy.email)).toEqual([
        'priya@example.com',
        'sneha@example.com',
      ]);
      const count = await asUser(t, admin.token).get('/api/admin/reports/open-count').expect(200);
      expect(count.body).toEqual({ count: 1 });
    });

    it('lets an admin remove a reported message or dismiss the reports', async () => {
      const offensive = await sent(rahul, 'Offensive');
      const harmless = await sent(rahul, 'Harmless joke');
      await report(sneha, offensive.id);
      await report(sneha, harmless.id, { reason: 'other' });

      const removed = await asUser(t, admin.token)
        .patch(`/api/admin/reports/${offensive.id}`, { decision: 'remove-message' })
        .expect(200);
      expect(removed.body).toMatchObject({
        status: 'actioned',
        message: { text: 'Offensive', isDeleted: true },
        reviewedBy: { name: 'Ananya Admin' },
      });
      await asUser(t, admin.token)
        .patch(`/api/admin/reports/${harmless.id}`, { decision: 'dismiss' })
        .expect(200);

      const messages = await history(mentor);
      expect(messages.find((m) => m.id === offensive.id)).toMatchObject({
        isDeleted: true,
        removedByModerator: true,
      });
      expect(messages.find((m) => m.id === harmless.id)?.isDeleted).toBe(false);

      const open = await asUser(t, admin.token).get('/api/admin/reports').expect(200);
      expect(open.body).toEqual([]);
      const dismissed = await asUser(t, admin.token)
        .get('/api/admin/reports?status=dismissed')
        .expect(200);
      expect((dismissed.body as ReportedMessage[]).map((r) => r.messageId)).toEqual([harmless.id]);
      await asUser(t, admin.token)
        .patch(`/api/admin/reports/${harmless.id}`, { decision: 'dismiss' })
        .expect(404);
    });

    it('lets an admin remove a reported message from a private chat they cannot open', async () => {
      const chat = await asUser(t, rahul.token)
        .post('/api/direct-chats', { userId: mentor.id })
        .expect(201);
      const conversationId = (chat.body as { conversationId: string }).conversationId;
      const ack = await emitWithAck<SendAck>(await connect(rahul), 'message:send', {
        conversationId,
        text: 'Inappropriate private message',
        clientId: 'private-report',
      });
      if (!ack.ok) throw new Error(ack.error);

      await report(mentor, ack.message.id, { reason: 'abuse' }).expect(201);
      const list = await asUser(t, admin.token).get('/api/admin/reports').expect(200);
      expect((list.body as ReportedMessage[])[0].conversation).toEqual({
        id: conversationId,
        type: 'direct',
        title: 'Private chat: Priya Mentor and Rahul Mentee',
      });

      await asUser(t, admin.token).get(`/api/conversations/${conversationId}/messages`).expect(404);
      await asUser(t, admin.token)
        .patch(`/api/admin/reports/${ack.message.id}`, { decision: 'remove-message' })
        .expect(200);
      expect((await history(mentor, conversationId)).at(-1)?.isDeleted).toBe(true);
    });
  });
});
