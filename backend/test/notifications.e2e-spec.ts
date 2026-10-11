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

interface NotificationBody {
  id: string;
  type: string;
  conversation: { id: string; type: string; name: string | null };
  messageId: string;
  actor: { id: string; name: string; role: string } | null;
  preview: string;
  readAt: string | null;
}

interface NotificationNew {
  notification: NotificationBody;
  unreadCount: number;
}

type SendAck = { ok: true; message: { id: string } } | { ok: false; error: string };

describe('Notifications (e2e)', () => {
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
  async function sent(user: SignedInUser, text: string, options: Record<string, unknown> = {}) {
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

  // Notifications are written just after the message is delivered, so wait for them.
  async function untilUnread(user: SignedInUser, count: number) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if ((await notificationsOf(user)).unreadCount === count) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Expected ${count} unread notifications`);
  }

  async function notificationsOf(user: SignedInUser) {
    const page = await asUser(t, user.token).get('/api/notifications').expect(200);
    return page.body as {
      notifications: NotificationBody[];
      unreadCount: number;
      hasMore: boolean;
    };
  }

  it('tells the author live when someone replies to their message', async () => {
    const question = await sent(rahul, 'Is the mock test online?');
    const rahulSocket = await connect(rahul);
    const arrived = nextEvent<NotificationNew>(rahulSocket, 'notification:new');

    const reply = await sent(mentor, 'Yes, on the portal.', { replyToId: question.id });

    expect(await arrived).toMatchObject({
      unreadCount: 1,
      notification: {
        type: 'reply',
        conversation: { id: groupId, type: 'group', name: 'TCS NQT Prep' },
        messageId: reply.id,
        actor: { name: 'Priya Mentor', role: 'mentor' },
        preview: 'Yes, on the portal.',
        readAt: null,
      },
    });
    expect(await notificationsOf(rahul)).toMatchObject({ unreadCount: 1, hasMore: false });
  });

  it('does not notify people about their own replies', async () => {
    const note = await sent(rahul, 'Note to self');
    const rahulSocket = await connect(rahul);
    await sent(rahul, 'Following up', { replyToId: note.id });

    await expectNoEvent(rahulSocket, 'notification:new');
    expect((await notificationsOf(rahul)).notifications).toEqual([]);
  });

  it('tells every other member about an announcement', async () => {
    const [rahulSocket, snehaSocket, mentorSocket] = await Promise.all([
      connect(rahul),
      connect(sneha),
      connect(mentor),
    ]);
    const forRahul = nextEvent<NotificationNew>(rahulSocket, 'notification:new');
    const forSneha = nextEvent<NotificationNew>(snehaSocket, 'notification:new');

    await sent(mentor, 'Mock test moved to Sunday', { isAnnouncement: true });

    expect((await forRahul).notification).toMatchObject({ type: 'announcement' });
    expect((await forSneha).notification).toMatchObject({ type: 'announcement' });
    await expectNoEvent(mentorSocket, 'notification:new');
  });

  it('tells a mentee once when their doubt is resolved', async () => {
    const doubt = await sent(rahul, 'How do I solve pipes and cisterns?', { isDoubt: true });
    const rahulSocket = await connect(rahul);
    const arrived = nextEvent<NotificationNew>(rahulSocket, 'notification:new');
    const setStatus = (status: string) =>
      asUser(t, mentor.token).patch(`/api/messages/${doubt.id}/doubt`, { status }).expect(200);

    await setStatus('resolved');
    expect((await arrived).notification).toMatchObject({
      type: 'doubt_resolved',
      messageId: doubt.id,
      actor: { name: 'Priya Mentor' },
      preview: 'How do I solve pipes and cisterns?',
    });

    await setStatus('open');
    await setStatus('resolved');
    await expectNoEvent(rahulSocket, 'notification:new');
    expect((await notificationsOf(rahul)).notifications).toHaveLength(1);
  });

  it('marks notifications read in every tab, one by one, all at once, or by opening the chat', async () => {
    await sent(mentor, 'Announcement one', { isAnnouncement: true });
    await sent(mentor, 'Announcement two', { isAnnouncement: true });
    await sent(mentor, 'Announcement three', { isAnnouncement: true });
    await untilUnread(rahul, 3);
    const [newest] = (await notificationsOf(rahul)).notifications;
    const otherTab = await connect(rahul);

    const readOne = nextEvent<{ unreadCount: number; ids: string[] }>(
      otherTab,
      'notifications:read',
    );
    const one = await asUser(t, rahul.token)
      .post('/api/notifications/read', { ids: [newest.id] })
      .expect(200);
    expect(one.body).toEqual({ unreadCount: 2 });
    expect(await readOne).toEqual({ unreadCount: 2, ids: [newest.id] });

    const openedChat = nextEvent<{ unreadCount: number; conversationId: string }>(
      otherTab,
      'notifications:read',
    );
    await asUser(t, rahul.token).post(`/api/conversations/${groupId}/read`).expect(204);
    expect(await openedChat).toEqual({ unreadCount: 0, conversationId: groupId });

    await sent(mentor, 'Announcement four', { isAnnouncement: true });
    await untilUnread(rahul, 1);
    const all = await asUser(t, rahul.token).post('/api/notifications/read').expect(200);
    expect(all.body).toEqual({ unreadCount: 0 });
    expect((await notificationsOf(rahul)).notifications.every((n) => n.readAt)).toBe(true);
  });

  it('removes the notifications of a deleted message', async () => {
    const rahulSocket = await connect(rahul);
    const arrived = nextEvent<NotificationNew>(rahulSocket, 'notification:new');
    const announcement = await sent(mentor, 'Wrong date, ignore', { isAnnouncement: true });
    const { notification } = await arrived;

    const removed = nextEvent<{ ids: string[]; unreadCount: number }>(
      rahulSocket,
      'notifications:removed',
    );
    await asUser(t, mentor.token).delete(`/api/messages/${announcement.id}`).expect(200);

    expect(await removed).toEqual({ ids: [notification.id], unreadCount: 0 });
    expect((await notificationsOf(rahul)).notifications).toEqual([]);
  });
});
