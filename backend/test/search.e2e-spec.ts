import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from '../src/modules/messages/schemas/message.schema';
import {
  asUser,
  clearDatabase,
  createTestApp,
  SignedInUser,
  signedInUser,
  TestApp,
} from './utils/test-app';

interface SearchPage {
  messages: Array<{ id: string; text: string; sender: { name: string } | null }>;
  hasMore: boolean;
}

describe('Message search (e2e)', () => {
  let t: TestApp;
  let messageModel: Model<Message>;
  let admin: SignedInUser;
  let mentor: SignedInUser;
  let rahul: SignedInUser;
  let outsider: SignedInUser;
  let groupId: string;

  beforeAll(async () => {
    t = await createTestApp();
    messageModel = t.app.get<Model<Message>>(getModelToken(Message.name));
    // The text index must exist before the first $text query.
    await messageModel.init();
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

  afterAll(async () => {
    await t.close();
  });

  /** Writes a long history straight to the database, oldest first. */
  async function seedHistory(entries: Array<Partial<Message> & { text: string }>) {
    const start = Date.now() - entries.length * 60_000;
    await messageModel.insertMany(
      entries.map((entry, index) => ({
        _id: Types.ObjectId.createFromTime(Math.floor((start + index * 60_000) / 1000)),
        conversationId: new Types.ObjectId(groupId),
        senderId: new Types.ObjectId(mentor.id),
        type: 'text',
        createdAt: new Date(start + index * 60_000),
        ...entry,
      })),
    );
  }

  const search = (user: SignedInUser, query: string) =>
    asUser(t, user.token).get(`/api/conversations/${groupId}/messages/search?${query}`);

  it('searches the whole history, newest first, but never deleted messages or system notes', async () => {
    await seedHistory([
      { text: 'The mock test link is on the portal' },
      ...Array.from({ length: 60 }, (_, i) => ({ text: `Filler message ${i}` })),
      { text: 'Mock tests every Saturday', deletedAt: new Date() },
      { text: 'Ananya moved the mock test', type: 'system' as const },
      {
        text: '',
        type: 'file' as const,
        attachment: {
          fileId: new Types.ObjectId(),
          name: 'mock-test-schedule.pdf',
          mimeType: 'application/pdf',
          size: 100,
          width: null,
          height: null,
        },
      },
      { text: 'Second mock test on Sunday' },
    ]);

    const page = (await search(rahul, 'q=mock').expect(200)).body as SearchPage;

    expect(page.messages.map((m) => m.text)).toEqual([
      'Second mock test on Sunday',
      '',
      'The mock test link is on the portal',
    ]);
    expect(page.messages[0].sender?.name).toBe('Priya Mentor');
    expect(page.hasMore).toBe(false);
  });

  it('pages through many matches with a cursor', async () => {
    await seedHistory(
      Array.from({ length: 45 }, (_, i) => ({ text: `Doubt number ${i} about percentages` })),
    );

    const first = (await search(rahul, 'q=percentages').expect(200)).body as SearchPage;
    const oldestShown = first.messages.at(-1)!.id;
    const second = (await search(rahul, `q=percentages&before=${oldestShown}`).expect(200))
      .body as SearchPage;
    const third = (
      await search(rahul, `q=percentages&before=${second.messages.at(-1)!.id}`).expect(200)
    ).body as SearchPage;

    expect([first.messages.length, second.messages.length, third.messages.length]).toEqual([
      20, 20, 5,
    ]);
    expect([first.hasMore, second.hasMore, third.hasMore]).toEqual([true, true, false]);
    const ids = [...first.messages, ...second.messages, ...third.messages].map((m) => m.id);
    expect(new Set(ids).size).toBe(45);
  });

  it('lets only people who can see the conversation search it', async () => {
    await seedHistory([{ text: 'Placement drive on Friday' }]);

    await search(outsider, 'q=placement').expect(404);
    const asModerator = (await search(admin, 'q=placement').expect(200)).body as SearchPage;
    expect(asModerator.messages).toHaveLength(1);
    await search(rahul, 'q=a').expect(400);
  });
});
