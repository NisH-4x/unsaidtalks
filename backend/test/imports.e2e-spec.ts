import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Socket } from 'socket.io-client';
import { Membership } from '../src/modules/conversations/schemas/membership.schema';
import { Message } from '../src/modules/messages/schemas/message.schema';
import { connectSocket, nextEvent } from './utils/sockets';
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
  type: string;
  text: string;
  sender: { id: string; name: string } | null;
  importedFrom: { source: string; senderName: string } | null;
  createdAt: string;
}

interface Preview {
  messageCount: number;
  dateOrder: string;
  dateOrderIsAmbiguous: boolean;
  skippedLines: number;
  senders: Array<{ name: string; messageCount: number; suggestedUserId: string | null }>;
  alreadyImported: { importedCount: number } | null;
  duplicateCount: number;
}

const IST = '-330';
const EXPORT = [
  '01/10/2025, 7:45 pm - Messages and calls are end-to-end encrypted.',
  '01/10/2025, 7:46 pm - Priya Mentor: Welcome to the old WhatsApp group!',
  'See you in class.',
  '02/10/2025, 9:05 am - +91 98765 43210: Is the mock online?',
  '02/10/2025, 9:06 am - Priya Mentor: Yes, on the portal.',
].join('\n');

describe('WhatsApp chat import (e2e)', () => {
  let t: TestApp;
  let admin: SignedInUser;
  let mentor: SignedInUser;
  let rahul: SignedInUser;
  let outsider: SignedInUser;
  let groupId: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await createTestApp({ listen: true });
    await t.app.get<Model<Message>>(getModelToken(Message.name)).init();
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

  function upload(
    user: SignedInUser,
    path: 'preview' | '',
    content: string | Buffer,
    fields: Record<string, string> = {},
  ) {
    let req = t
      .http()
      .post(`/api/admin/groups/${groupId}/imports${path ? `/${path}` : ''}`)
      .set('Authorization', `Bearer ${user.token}`)
      .field('timezoneOffsetMinutes', IST);
    for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
    return req.attach('file', Buffer.isBuffer(content) ? content : Buffer.from(content), {
      filename: 'WhatsApp Chat with Batch 12.txt',
      contentType: 'text/plain',
    });
  }

  const linkPriya = () =>
    JSON.stringify({ 'Priya Mentor': mentor.id, 'WhatsApp contact ending 3210': null });

  async function history(user: SignedInUser) {
    const page = await asUser(t, user.token)
      .get(`/api/conversations/${groupId}/messages`)
      .expect(200);
    return (page.body as { messages: MessageBody[] }).messages;
  }

  it('previews an export without storing anything, suggesting members by name', async () => {
    const response = await upload(admin, 'preview', EXPORT).expect(200);
    const preview = response.body as Preview;

    expect(preview).toMatchObject({
      messageCount: 3,
      dateOrder: 'day-first',
      dateOrderIsAmbiguous: true,
      skippedLines: 1,
      alreadyImported: null,
      duplicateCount: 0,
    });
    expect(preview.senders).toEqual([
      { name: 'Priya Mentor', messageCount: 2, suggestedUserId: mentor.id },
      { name: 'WhatsApp contact ending 3210', messageCount: 1, suggestedUserId: null },
    ]);
    expect(await history(admin)).toHaveLength(2);
  });

  it('imports history in its original order and times, marked as imported, without unread counts', async () => {
    const socket = await connectSocket(t.url, rahul.token);
    sockets.push(socket);
    const refreshed = nextEvent<{ conversationId: string }>(socket, 'conversation:history');

    const response = await upload(admin, '', EXPORT, { mapping: linkPriya() }).expect(201);
    expect(response.body).toMatchObject({ importedCount: 3, skippedCount: 0 });
    expect(await refreshed).toEqual({ conversationId: groupId });

    const messages = await history(rahul);
    const imported = messages.filter((m) => m.importedFrom);
    expect(
      imported.map((m) => [
        m.createdAt,
        m.sender?.name ?? null,
        m.importedFrom?.senderName,
        m.text,
      ]),
    ).toEqual([
      [
        '2025-10-01T14:16:00.000Z',
        'Priya Mentor',
        'Priya Mentor',
        'Welcome to the old WhatsApp group!\nSee you in class.',
      ],
      ['2025-10-02T03:35:00.000Z', null, 'WhatsApp contact ending 3210', 'Is the mock online?'],
      ['2025-10-02T03:36:00.000Z', 'Priya Mentor', 'Priya Mentor', 'Yes, on the portal.'],
    ]);
    // Older than the group, so the imported history comes first; the note about it comes last.
    expect(messages.slice(0, 3)).toEqual(imported);
    expect(messages.at(-1)).toMatchObject({
      type: 'system',
      text: 'Ananya Admin imported 3 messages from a WhatsApp chat',
    });
    expect(JSON.stringify(messages)).not.toContain('98765');

    const membership = await t.app
      .get<Model<Membership>>(getModelToken(Membership.name))
      .findOne({ conversationId: groupId, userId: rahul.id })
      .lean();
    expect(membership?.unreadCount).toBe(0);

    const search = await asUser(t, rahul.token)
      .get(`/api/conversations/${groupId}/messages/search?q=portal`)
      .expect(200);
    expect((search.body as { messages: MessageBody[] }).messages).toHaveLength(1);
  });

  it('refuses the same file twice and skips messages an overlapping export already brought in', async () => {
    await upload(admin, '', EXPORT, { mapping: linkPriya() }).expect(201);

    const again = await upload(admin, '', EXPORT, { mapping: linkPriya() }).expect(409);
    expect((again.body as { message: string }).message).toBe(
      'This file has already been imported into this group',
    );
    const preview = (await upload(admin, 'preview', EXPORT).expect(200)).body as Preview;
    expect(preview).toMatchObject({ alreadyImported: { importedCount: 3 }, duplicateCount: 3 });

    const longer = `${EXPORT}\n03/10/2025, 6:00 pm - Priya Mentor: Recording is uploaded.`;
    const result = await upload(admin, '', longer, { mapping: linkPriya() }).expect(201);
    expect(result.body).toMatchObject({ importedCount: 1, skippedCount: 3 });
  });

  it('only lets admins import, only into groups, and only links senders to members', async () => {
    await upload(mentor, 'preview', EXPORT).expect(403);
    await upload(admin, '', EXPORT, {
      mapping: JSON.stringify({ 'Priya Mentor': outsider.id }),
    }).expect(400);
    await upload(admin, '', EXPORT, { mapping: 'not json' }).expect(400);

    const chat = await asUser(t, rahul.token)
      .post('/api/direct-chats', { userId: mentor.id })
      .expect(201);
    await t
      .http()
      .post(
        `/api/admin/groups/${(chat.body as { conversationId: string }).conversationId}/imports/preview`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .field('timezoneOffsetMinutes', IST)
      .attach('file', Buffer.from(EXPORT), { filename: 'chat.txt', contentType: 'text/plain' })
      .expect(404);
  });

  it('explains files that are not a text export of a chat', async () => {
    const zip = Buffer.concat([Buffer.from('PK'), Buffer.from([3, 4, 20, 0])]);
    const asZip = await upload(admin, 'preview', zip).expect(400);
    expect((asZip.body as { message: string }).message).toContain('.zip');

    const notes = await upload(admin, 'preview', 'Just some notes, no dates here').expect(400);
    expect((notes.body as { message: string }).message).toBe(
      'No messages were found. Upload a chat exported from WhatsApp as a .txt file.',
    );
  });
});
