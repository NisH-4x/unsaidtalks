import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Socket } from 'socket.io-client';
import {
  Conversation,
  directKeyFor,
} from '../src/modules/conversations/schemas/conversation.schema';
import { ConversationsService } from '../src/modules/conversations/conversations.service';
import { Membership } from '../src/modules/conversations/schemas/membership.schema';
import { Message } from '../src/modules/messages/schemas/message.schema';
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
  conversationId: string;
  type: string;
  text: string;
  sender: { id: string; name: string; role: string } | null;
  createdAt: string;
}

type SendAck = { ok: true; message: MessageBody } | { ok: false; error: string };
type SimpleAck = { ok: true } | { ok: false; error: string };

interface MessagePageBody {
  messages: MessageBody[];
  hasMore: boolean;
}

describe('Real-time messaging (e2e)', () => {
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

  function send(socket: Socket, text: string, conversationId = groupId, clientId = 'draft-1') {
    return emitWithAck<SendAck>(socket, 'message:send', { conversationId, text, clientId });
  }

  async function unreadFor(user: SignedInUser): Promise<number | undefined> {
    const response = await asUser(t, user.token).get('/api/conversations').expect(200);
    const list = response.body as Array<{ id: string; unreadCount: number }>;
    return list.find((chat) => chat.id === groupId)?.unreadCount;
  }

  it('refuses socket connections without a valid access token', async () => {
    await expect(connectSocket(t.url, undefined)).rejects.toThrow('unauthorized');
    await expect(connectSocket(t.url, 'not-a-jwt')).rejects.toThrow('unauthorized');
  });

  it('delivers a message instantly to every member and to no one else', async () => {
    const [mentorSocket, rahulSocket, snehaSocket] = await Promise.all(
      [mentor, rahul, sneha].map(connect),
    );
    const rahulReceives = nextEvent<{ message: MessageBody; preview: string; clientId?: string }>(
      rahulSocket,
      'message:new',
    );
    const outsiderReceivesNothing = expectNoEvent(snehaSocket, 'message:new');

    const ack = await send(mentorSocket, '  Mock test on Saturday at 10 AM  ', groupId, 'draft-42');

    if (!ack.ok) throw new Error(ack.error);
    expect(ack.message).toMatchObject({
      conversationId: groupId,
      type: 'text',
      text: 'Mock test on Saturday at 10 AM',
      sender: { id: mentor.id, name: 'Priya Mentor', role: 'mentor' },
    });
    const delivered = await rahulReceives;
    expect(delivered.message.id).toBe(ack.message.id);
    expect(delivered.clientId).toBe('draft-42');
    expect(delivered.preview).toBe('Mock test on Saturday at 10 AM');
    await outsiderReceivesNothing;
  });

  it('resending the same draft returns the stored message instead of a duplicate', async () => {
    const mentorSocket = await connect(mentor);

    const first = await send(mentorSocket, 'Resources are pinned', groupId, 'draft-retry');
    const retry = await send(mentorSocket, 'Resources are pinned', groupId, 'draft-retry');

    if (!first.ok || !retry.ok) throw new Error('send failed');
    expect(retry.message.id).toBe(first.message.id);
    const page = (
      await asUser(t, rahul.token).get(`/api/conversations/${groupId}/messages`).expect(200)
    ).body as MessagePageBody;
    expect(page.messages.filter((m) => m.text === 'Resources are pinned')).toHaveLength(1);
    expect(await unreadFor(rahul)).toBe(1);
  });

  it('stores messages so they come back in the history after a refresh', async () => {
    const mentorSocket = await connect(mentor);
    const ack = await send(mentorSocket, 'Please revise percentages tonight');
    if (!ack.ok) throw new Error(ack.error);

    const response = await asUser(t, rahul.token)
      .get(`/api/conversations/${groupId}/messages`)
      .expect(200);
    const page = response.body as MessagePageBody;

    expect(page.hasMore).toBe(false);
    expect(page.messages.map((m) => m.type)).toEqual(['system', 'system', 'text']);
    expect(page.messages[2]).toMatchObject({
      id: ack.message.id,
      text: 'Please revise percentages tonight',
    });
    expect(page.messages[0].sender).toBeNull();
  });

  it('rejects invalid messages and conversations the sender cannot see', async () => {
    const [mentorSocket, snehaSocket] = await Promise.all([connect(mentor), connect(sneha)]);

    expect(await send(mentorSocket, '   ')).toMatchObject({ ok: false });
    expect(await send(mentorSocket, 'x'.repeat(4001))).toMatchObject({ ok: false });
    expect(
      await emitWithAck<SendAck>(mentorSocket, 'message:send', {
        conversationId: groupId,
        text: 'hi',
        clientId: 'a',
        colour: 'gold',
      }),
    ).toMatchObject({ ok: false });
    expect(await send(snehaSocket, 'Can I join?')).toEqual({
      ok: false,
      error: 'Conversation not found',
    });
  });

  it('counts unread messages for recipients only and clears them when read', async () => {
    const mentorSocket = await connect(mentor);
    const rahulOtherTab = await connect(rahul);
    await send(mentorSocket, 'First');
    await send(mentorSocket, 'Second', groupId, 'draft-2');

    expect(await unreadFor(rahul)).toBe(2);
    expect(await unreadFor(mentor)).toBe(0);

    const otherTabSynced = nextEvent<{ conversationId: string }>(
      rahulOtherTab,
      'conversation:read',
    );
    await asUser(t, rahul.token).post(`/api/conversations/${groupId}/read`).expect(204);

    expect(await unreadFor(rahul)).toBe(0);
    expect((await otherTabSynced).conversationId).toBe(groupId);
  });

  it('keeps the later message as the chat preview when two are processed out of order', async () => {
    const conversations = t.app.get(ConversationsService);
    const lastMessage = (preview: string) => ({
      messageId: new Types.ObjectId(),
      senderId: new Types.ObjectId(mentor.id),
      senderName: 'Priya Mentor',
      type: 'text' as const,
      preview,
      sentAt: new Date(),
    });
    const earlier = lastMessage('Coding round tomorrow');
    const later = lastMessage('Revise two-pointer problems');

    await conversations.applyNewMessage(groupId, later, { senderId: mentor.id });
    await conversations.applyNewMessage(groupId, earlier, { senderId: mentor.id });

    const conversation = await t.app
      .get<Model<Conversation>>(getModelToken(Conversation.name))
      .findById(groupId)
      .lean();
    expect(conversation?.lastMessage?.preview).toBe('Revise two-pointer problems');
    const membership = await t.app
      .get<Model<Membership>>(getModelToken(Membership.name))
      .findOne({ conversationId: groupId, userId: mentor.id })
      .lean();
    expect(membership?.lastReadMessageId?.equals(later.messageId)).toBe(true);
  });

  it('pages through history with cursors without gaps or duplicates', async () => {
    const messages = t.app.get<Model<Message>>(getModelToken(Message.name));
    await messages.insertMany(
      Array.from({ length: 75 }, (_, index) => ({
        conversationId: groupId,
        senderId: mentor.user._id,
        type: 'text',
        text: `Message ${index + 1}`,
      })),
    );
    const api = asUser(t, rahul.token);
    const historyUrl = `/api/conversations/${groupId}/messages`;

    const newest = (await api.get(historyUrl).expect(200)).body as MessagePageBody;
    const middle = (await api.get(`${historyUrl}?before=${newest.messages[0].id}`).expect(200))
      .body as MessagePageBody;
    const oldest = (await api.get(`${historyUrl}?before=${middle.messages[0].id}`).expect(200))
      .body as MessagePageBody;

    expect([newest, middle, oldest].map((page) => page.messages.length)).toEqual([30, 30, 17]);
    expect([newest, middle, oldest].map((page) => page.hasMore)).toEqual([true, true, false]);
    expect(newest.messages.at(-1)?.text).toBe('Message 75');

    const all = [...oldest.messages, ...middle.messages, ...newest.messages].map((m) => m.id);
    expect(new Set(all).size).toBe(77);
    expect(all).toEqual([...all].sort());

    const missed = (await api.get(`${historyUrl}?after=${all[69]}`).expect(200))
      .body as MessagePageBody;
    expect(missed.messages.map((m) => m.id)).toEqual(all.slice(70));

    await api.get(`${historyUrl}?before=${all[5]}&after=${all[1]}`).expect(400);
    await api.get(`${historyUrl}?limit=500`).expect(400);
    await asUser(t, sneha.token).get(historyUrl).expect(404);
  });

  it('a member added later starts receiving messages without reconnecting', async () => {
    const [mentorSocket, snehaSocket] = await Promise.all([connect(mentor), connect(sneha)]);
    const added = nextEvent<{ conversationId: string }>(snehaSocket, 'conversation:added');

    await asUser(t, admin.token)
      .post(`/api/admin/groups/${groupId}/members`, { userIds: [sneha.id] })
      .expect(201);
    expect((await added).conversationId).toBe(groupId);

    const received = nextEvent<{ message: MessageBody }>(snehaSocket, 'message:new');
    await send(mentorSocket, 'Welcome, Sneha!');
    expect((await received).message.text).toBe('Welcome, Sneha!');
  });

  it('a removed member stops receiving messages immediately', async () => {
    const [mentorSocket, rahulSocket] = await Promise.all([connect(mentor), connect(rahul)]);
    const removed = nextEvent<{ conversationId: string }>(rahulSocket, 'conversation:removed');

    await asUser(t, admin.token)
      .delete(`/api/admin/groups/${groupId}/members/${rahul.id}`)
      .expect(200);
    expect((await removed).conversationId).toBe(groupId);

    const nothing = expectNoEvent(rahulSocket, 'message:new');
    await send(mentorSocket, 'Only for current members');
    await nothing;
  });

  it('disconnects every socket of a deactivated user', async () => {
    const rahulSocket = await connect(rahul);
    const disconnected = nextEvent<string>(rahulSocket, 'disconnect');

    await asUser(t, admin.token)
      .patch(`/api/admin/users/${rahul.id}`, { status: 'deactivated' })
      .expect(200);

    expect(await disconnected).toBe('io server disconnect');
  });

  it('limits how fast one person can send', async () => {
    const mentorSocket = await connect(mentor);

    const results = [];
    for (let index = 0; index < 11; index += 1) {
      results.push(await send(mentorSocket, `Message ${index}`, groupId, `draft-${index}`));
    }

    expect(results.slice(0, 10).every((result) => result.ok)).toBe(true);
    expect(results[10]).toEqual({
      ok: false,
      error: 'You are sending messages too quickly. Please wait a moment.',
    });
  });

  it('lets an admin follow and post in a group as a moderator, but not join private chats', async () => {
    const conversations = t.app.get<Model<Conversation>>(getModelToken(Conversation.name));
    const memberships = t.app.get<Model<Membership>>(getModelToken(Membership.name));
    const direct = await conversations.create({
      type: 'direct',
      participantIds: [mentor.user._id, rahul.user._id],
      directKey: directKeyFor(mentor.user._id, rahul.user._id),
    });
    await memberships.insertMany([
      { conversationId: direct._id, userId: mentor.user._id },
      { conversationId: direct._id, userId: rahul.user._id },
    ]);
    const [adminSocket, mentorSocket] = await Promise.all([connect(admin), connect(mentor)]);

    expect(
      await emitWithAck<SimpleAck>(adminSocket, 'conversation:open', { conversationId: groupId }),
    ).toEqual({ ok: true });
    const adminSees = nextEvent<{ message: MessageBody }>(adminSocket, 'message:new');
    await send(mentorSocket, 'Admin, please pin the schedule');
    expect((await adminSees).message.text).toBe('Admin, please pin the schedule');

    const adminAck = await send(adminSocket, 'Done, pinned it.');
    expect(adminAck).toMatchObject({ ok: true, message: { sender: { role: 'admin' } } });

    expect(
      await emitWithAck<SimpleAck>(adminSocket, 'conversation:open', {
        conversationId: direct._id.toHexString(),
      }),
    ).toEqual({ ok: false, error: 'Conversation not found' });
    expect(await send(adminSocket, 'Hello', direct._id.toHexString())).toMatchObject({
      ok: false,
    });
    expect(
      await emitWithAck<SimpleAck>(adminSocket, 'conversation:open', {
        conversationId: new Types.ObjectId().toHexString(),
      }),
    ).toMatchObject({ ok: false });
  });
});
