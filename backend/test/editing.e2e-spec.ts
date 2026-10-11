import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Socket } from 'socket.io-client';
import { EDIT_WINDOW_MS, Message } from '../src/modules/messages/schemas/message.schema';
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
  editedAt: string | null;
  replyTo: { preview: string } | null;
}

type SendAck = { ok: true; message: MessageBody } | { ok: false; error: string };

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Editing messages (e2e)', () => {
  let t: TestApp;
  let messageModel: Model<Message>;
  let admin: SignedInUser;
  let mentor: SignedInUser;
  let rahul: SignedInUser;
  let outsider: SignedInUser;
  let groupId: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await createTestApp({ listen: true });
    messageModel = t.app.get<Model<Message>>(getModelToken(Message.name));
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

  const editAs = (user: SignedInUser, messageId: string, text: string) =>
    asUser(t, user.token).patch(`/api/messages/${messageId}`, { text });

  // Mongoose treats createdAt as immutable, so the send time is moved on the raw collection.
  const sentAgo = (messageId: string, ms: number) =>
    messageModel.collection.updateOne(
      { _id: new Types.ObjectId(messageId) },
      { $set: { createdAt: new Date(Date.now() - ms) } },
    );

  it('lets the sender fix a message, live for everyone, with quotes and previews following', async () => {
    const original = await sent(rahul, 'Mock test is on Satuday');
    const reply = await sent(mentor, 'Thanks for sharing', { replyToId: original.id });
    const watcher = await connect(mentor);
    const updated = nextEvent<{ message: MessageBody }>(watcher, 'message:updated');

    const response = await editAs(rahul, original.id, 'Mock test is on Saturday').expect(200);

    expect(response.body).toMatchObject({ text: 'Mock test is on Saturday' });
    expect((response.body as MessageBody).editedAt).not.toBeNull();
    expect((await updated).message).toMatchObject({
      id: original.id,
      text: 'Mock test is on Saturday',
    });

    const history = await asUser(t, mentor.token)
      .get(`/api/conversations/${groupId}/messages`)
      .expect(200);
    const replyNow = (history.body as { messages: MessageBody[] }).messages.find(
      (m) => m.id === reply.id,
    );
    expect(replyNow?.replyTo?.preview).toBe('Mock test is on Saturday');
  });

  it('allows edits up to five minutes after sending and refuses them afterwards', async () => {
    const message = await sent(rahul, 'First version');

    await sentAgo(message.id, EDIT_WINDOW_MS - 2_000);
    await editAs(rahul, message.id, 'Edited just in time').expect(200);

    await sentAgo(message.id, EDIT_WINDOW_MS + 2_000);
    const late = await editAs(rahul, message.id, 'Too late').expect(403);
    expect((late.body as { message: string }).message).toBe(
      'Messages can only be edited within 5 minutes of sending',
    );
  });

  it('lets nobody edit someone else’s message, a deleted message or a system note', async () => {
    const message = await sent(rahul, 'Mine');

    await editAs(mentor, message.id, 'Not yours').expect(403);
    await editAs(admin, message.id, 'Not yours either').expect(403);
    await editAs(outsider, message.id, 'Cannot even see it').expect(404);
    await editAs(rahul, message.id, '   ').expect(400);

    const [note] = (
      (await asUser(t, admin.token).get(`/api/conversations/${groupId}/messages`).expect(200))
        .body as { messages: MessageBody[] }
    ).messages;
    await editAs(admin, note.id, 'Rewritten history').expect(400);

    await asUser(t, rahul.token).delete(`/api/messages/${message.id}`).expect(200);
    await editAs(rahul, message.id, 'Back from the dead').expect(400);
  });

  it('lets a caption be changed or cleared, but never the file', async () => {
    const upload = await t
      .http()
      .post(`/api/conversations/${groupId}/attachments`)
      .set('Authorization', `Bearer ${rahul.token}`)
      .field('clientId', 'photo-1')
      .field('text', 'Question 4')
      .attach('file', PNG, { filename: 'q4.png', contentType: 'image/png' })
      .expect(201);
    const photo = upload.body as MessageBody & { attachment: { name: string } };

    const cleared = await editAs(rahul, photo.id, '').expect(200);
    expect(cleared.body).toMatchObject({ text: '', attachment: { name: 'q4.png' } });
  });
});
