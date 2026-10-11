import { Socket } from 'socket.io-client';
import { GroqClient, GroqError } from '../src/modules/ai/groq.client';
import { connectSocket, emitWithAck } from './utils/sockets';
import {
  asUser,
  clearDatabase,
  createTestApp,
  SignedInUser,
  signedInUser,
  TestApp,
} from './utils/test-app';

interface Summary {
  status: string;
  doubtCount: number;
  overview: string;
  model: string | null;
  topics: Array<{
    title: string;
    summary: string;
    doubts: Array<{ messageId: string; askedBy: string; preview: string }>;
  }>;
}

type SendAck = { ok: true; message: { id: string } } | { ok: false; error: string };

// Stands in for the real Groq API: automated tests never call an external service.
const groq = {
  model: 'groq-test',
  isConfigured: jest.fn(() => true),
  generateJson: jest.fn(),
};

describe('AI summary of open doubts (e2e)', () => {
  let t: TestApp;
  let admin: SignedInUser;
  let mentor: SignedInUser;
  let rahul: SignedInUser;
  let sneha: SignedInUser;
  let outsider: SignedInUser;
  let groupId: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await createTestApp({
      listen: true,
      overrides: [{ provide: GroqClient, useValue: groq }],
    });
  });

  beforeEach(async () => {
    await clearDatabase(t.connection);
    groq.isConfigured.mockReturnValue(true);
    groq.generateJson.mockReset();
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
      name: 'Other Mentor',
      email: 'other@example.com',
      role: 'mentor',
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

  let draft = 0;
  async function sent(user: SignedInUser, text: string, options: Record<string, unknown> = {}) {
    draft += 1;
    const socket = await connectSocket(t.url, user.token);
    sockets.push(socket);
    const ack = await emitWithAck<SendAck>(socket, 'message:send', {
      conversationId: groupId,
      text,
      clientId: `draft-${draft}`,
      ...options,
    });
    if (!ack.ok) throw new Error(ack.error);
    return ack.message;
  }

  const summarise = (user: SignedInUser, conversationId = groupId) =>
    asUser(t, user.token).post(`/api/conversations/${conversationId}/doubts/summary`);

  async function threeDoubts() {
    const lis = await sent(rahul, 'How do I get LIS down to n log n?', { isDoubt: true });
    const coin = await sent(sneha, 'Coin change bottom-up: where do I start?', { isDoubt: true });
    const resolved = await sent(sneha, 'Is the mock on Saturday?', { isDoubt: true });
    await asUser(t, mentor.token)
      .patch(`/api/messages/${resolved.id}/doubt`, { status: 'resolved' })
      .expect(200);
    await sent(mentor, 'Think about patience sorting.', { replyToId: lis.id });
    return { lis, coin };
  }

  it('summarises only open doubts, with names and links from the database', async () => {
    const { lis, coin } = await threeDoubts();
    groq.generateJson.mockResolvedValue({
      overview: 'Two dynamic programming questions are waiting.',
      topics: [
        {
          title: 'LIS optimisation',
          summary: 'Wants the O(n log n) method.',
          doubtIds: ['d1', 'd7'],
        },
      ],
    });

    const response = await summarise(mentor).expect(200);
    const summary = response.body as Summary;

    expect(summary).toMatchObject({
      status: 'ready',
      doubtCount: 2,
      overview: 'Two dynamic programming questions are waiting.',
      model: 'groq-test',
    });
    expect(
      summary.topics.map((t) => [t.title, t.doubts.map((d) => [d.messageId, d.askedBy])]),
    ).toEqual([
      ['LIS optimisation', [[lis.id, 'Rahul Mentee']]],
      ['Not included by the AI', [[coin.id, 'Sneha Mentee']]],
    ]);

    const [{ prompt }] = groq.generateJson.mock.calls[0] as [{ prompt: string }];
    expect(prompt).toContain('[d1] Rahul Mentee');
    expect(prompt).toContain('Think about patience sorting.');
    expect(prompt).not.toContain('Is the mock on Saturday?');
    expect(prompt).not.toContain('@example.com');
  });

  it('reuses a recent summary until the open doubts change', async () => {
    await threeDoubts();
    groq.generateJson.mockResolvedValue({ overview: 'Summary', topics: [] });

    await summarise(mentor).expect(200);
    await summarise(admin).expect(200);
    expect(groq.generateJson).toHaveBeenCalledTimes(1);

    await sent(rahul, 'And what about edit distance?', { isDoubt: true });
    await summarise(mentor).expect(200);
    expect(groq.generateJson).toHaveBeenCalledTimes(2);
  });

  it('says there is nothing to summarise without calling the AI', async () => {
    const response = await summarise(mentor).expect(200);
    expect(response.body).toMatchObject({ status: 'empty', doubtCount: 0, topics: [] });
    expect(groq.generateJson).not.toHaveBeenCalled();
  });

  it('is for the mentors and admins of a group only', async () => {
    await summarise(rahul).expect(403);
    await summarise(outsider).expect(404);
    const chat = await asUser(t, rahul.token)
      .post('/api/direct-chats', { userId: mentor.id })
      .expect(201);
    await summarise(mentor, (chat.body as { conversationId: string }).conversationId).expect(400);
  });

  it('reports a missing key, a busy service or a failure instead of making something up', async () => {
    await threeDoubts();

    groq.isConfigured.mockReturnValue(false);
    const off = await summarise(mentor).expect(503);
    expect((off.body as { message: string }).message).toBe(
      'AI summaries are not set up on this server.',
    );

    groq.isConfigured.mockReturnValue(true);
    groq.generateJson.mockRejectedValueOnce(new GroqError('rate-limited'));
    await summarise(mentor).expect(429);

    groq.generateJson.mockRejectedValueOnce(new GroqError('unavailable'));
    const failed = await summarise(mentor).expect(502);
    expect((failed.body as { message: string }).message).toBe(
      'The AI summary could not be generated right now. Please try again later.',
    );

    groq.generateJson.mockResolvedValueOnce('not a summary');
    await summarise(mentor).expect(502);
  });
});
