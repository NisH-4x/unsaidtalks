import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Socket } from 'socket.io-client';
import request from 'supertest';
import { ATTACHMENTS_BUCKET } from '../src/modules/attachments/attachment-storage.service';
import { MAX_ATTACHMENT_BYTES } from '../src/modules/attachments/attachment-types';
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

interface AttachmentMessage {
  id: string;
  type: string;
  text: string;
  attachment: {
    name: string;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
  } | null;
  doubt: { status: string } | null;
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

// Collects any response body as raw bytes, whatever its content type.
function binary(response: request.Response, done: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => done(null, Buffer.concat(chunks)));
}

describe('File sharing (e2e)', () => {
  let t: TestApp;
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

  let draft = 0;
  function upload(
    user: SignedInUser,
    file: { content: Buffer; name: string; type: string } | null,
    fields: Record<string, string> = {},
  ) {
    draft += 1;
    let req = t
      .http()
      .post(`/api/conversations/${groupId}/attachments`)
      .set('Authorization', `Bearer ${user.token}`)
      .field('clientId', `upload-${draft}`);
    for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
    if (file)
      req = req.attach('file', file.content, { filename: file.name, contentType: file.type });
    return req;
  }

  function download(user: SignedInUser, messageId: string, query = '') {
    return t
      .http()
      .get(`/api/messages/${messageId}/attachment${query}`)
      .set('Authorization', `Bearer ${user.token}`)
      .buffer(true)
      .parse(binary);
  }

  const storedFiles = () => t.connection.collection(`${ATTACHMENTS_BUCKET}.files`).countDocuments();
  const storedMessages = () =>
    t.app
      .get<Model<Message>>(getModelToken(Message.name))
      .countDocuments({ type: { $ne: 'system' } });

  it('shares an image that other members receive live and can view inline', async () => {
    const socket = await connectSocket(t.url, rahul.token);
    sockets.push(socket);
    const received = nextEvent<{ message: AttachmentMessage; preview: string }>(
      socket,
      'message:new',
    );

    const response = await upload(
      mentor,
      { content: PNG, name: 'question 3.png', type: 'image/png' },
      { text: 'Try this one', width: '640', height: '480' },
    ).expect(201);
    const message = response.body as AttachmentMessage;

    expect(message).toMatchObject({
      type: 'image',
      text: 'Try this one',
      attachment: {
        name: 'question 3.png',
        mimeType: 'image/png',
        size: PNG.length,
        width: 640,
        height: 480,
      },
    });
    expect(message.attachment).not.toHaveProperty('fileId');
    const event = await received;
    expect(event.message.id).toBe(message.id);
    expect(event.preview).toBe('Try this one');

    const file = await download(rahul, message.id).expect(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['content-disposition']).toMatch(/^inline; filename="question 3.png"/);
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(file.body as Buffer, PNG)).toBe(0);

    const asDownload = await download(rahul, message.id, '?download=true').expect(200);
    expect(asDownload.headers['content-disposition']).toMatch(/^attachment;/);

    await t
      .http()
      .get(`/api/messages/${message.id}/attachment`)
      .set('Authorization', `Bearer ${rahul.token}`)
      .set('If-None-Match', file.headers.etag)
      .expect(304);
  });

  it('identifies the real type from the content and always downloads PDFs', async () => {
    const response = await upload(mentor, {
      content: PDF,
      name: 'formula sheet',
      type: 'image/png',
    }).expect(201);
    const message = response.body as AttachmentMessage;

    expect(message).toMatchObject({
      type: 'file',
      text: '',
      attachment: { name: 'formula sheet.pdf', mimeType: 'application/pdf', width: null },
    });

    const file = await download(rahul, message.id).expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['content-disposition']).toMatch(
      /^attachment; filename="formula sheet.pdf"/,
    );

    const chats = await asUser(t, rahul.token).get('/api/conversations').expect(200);
    const [chat] = chats.body as Array<{ lastMessage: { type: string; preview: string } }>;
    expect(chat.lastMessage).toMatchObject({ type: 'file', preview: 'formula sheet.pdf' });
  });

  it('rejects anything that is not an image or a PDF, even when labelled as an image', async () => {
    const response = await upload(mentor, { content: SVG, name: 'chart.png', type: 'image/png' });

    expect(response.status).toBe(415);
    expect((response.body as { message: string }).message).toBe(
      'Only images (JPEG, PNG, WebP, GIF) and PDF files can be shared',
    );
    expect(await storedFiles()).toBe(0);
    expect(await storedMessages()).toBe(0);
  });

  it('rejects files over 5 MB and requests without a file', async () => {
    const tooBig = Buffer.concat([PNG, Buffer.alloc(MAX_ATTACHMENT_BYTES)]);
    await upload(mentor, { content: tooBig, name: 'big.png', type: 'image/png' }).expect(413);

    const missing = await upload(mentor, null, { text: 'Where is the file?' }).expect(400);
    expect((missing.body as { message: string }).message).toBe('Choose a file to send');
    expect(await storedFiles()).toBe(0);
  });

  it('lets only members share or open files', async () => {
    await upload(outsider, { content: PNG, name: 'x.png', type: 'image/png' }).expect(404);
    expect(await storedFiles()).toBe(0);

    const shared = await upload(mentor, { content: PNG, name: 'x.png', type: 'image/png' });
    await download(outsider, (shared.body as AttachmentMessage).id).expect(404);
  });

  it('stores a retried upload only once', async () => {
    const send = () =>
      t
        .http()
        .post(`/api/conversations/${groupId}/attachments`)
        .set('Authorization', `Bearer ${mentor.token}`)
        .field('clientId', 'same-draft')
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });

    const first = await send().expect(201);
    const retry = await send().expect(201);

    expect((retry.body as AttachmentMessage).id).toBe((first.body as AttachmentMessage).id);
    expect(await storedFiles()).toBe(1);
    expect(await storedMessages()).toBe(1);
  });

  it('applies the same rules as text messages to doubts and announcements', async () => {
    const doubt = await upload(
      rahul,
      { content: PNG, name: 'doubt.png', type: 'image/png' },
      { isDoubt: 'true' },
    ).expect(201);
    expect((doubt.body as AttachmentMessage).doubt).toMatchObject({ status: 'open' });

    await upload(
      rahul,
      { content: PDF, name: 'notice.pdf', type: 'application/pdf' },
      { isAnnouncement: 'true' },
    ).expect(403);
    await upload(
      rahul,
      { content: PNG, name: 'x.png', type: 'image/png' },
      { isDoubt: 'maybe' },
    ).expect(400);
    expect(await storedFiles()).toBe(1);
  });

  it('stops serving the file of a deleted message', async () => {
    const shared = await upload(mentor, { content: PNG, name: 'x.png', type: 'image/png' });
    const id = (shared.body as AttachmentMessage).id;
    await t.app
      .get<Model<Message>>(getModelToken(Message.name))
      .updateOne({ _id: id }, { deletedAt: new Date() });

    await download(rahul, id).expect(404);
  });
});
