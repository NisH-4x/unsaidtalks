import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { canResolveDoubts } from '../access/access-policy';
import { AuthUser } from '../auth/auth-user';
import { ConversationsService } from '../conversations/conversations.service';
import { Message } from '../messages/schemas/message.schema';
import { UsersService } from '../users/users.service';
import {
  buildDoubtPrompt,
  DoubtForSummary,
  reconcileSummary,
  SUMMARY_INSTRUCTION,
  SUMMARY_SCHEMA,
} from './doubt-summary.prompt';
import { GroqClient, GroqError } from './groq.client';

const MAX_DOUBTS = 40;
const MAX_REPLIES_PER_DOUBT = 3;
const TEXT_LIMIT = 600;
const CACHE_TTL_MS = 10 * 60 * 1000;

type StoredMessage = Message & { _id: Types.ObjectId };

export interface DoubtSummaryView {
  status: 'ready' | 'empty';
  /** Open doubts the summary covers, and older ones left out to keep the request small. */
  doubtCount: number;
  omittedCount: number;
  overview: string;
  topics: Array<{
    title: string;
    summary: string;
    doubts: Array<{ messageId: string; askedBy: string; askedAt: Date; preview: string }>;
  }>;
  generatedAt: Date | null;
  model: string | null;
}

/** An AI overview of a group's open doubts, generated with Groq for its mentors and admins. */
@Injectable()
export class DoubtSummaryService {
  private readonly cache = new Map<
    string,
    { key: string; view: DoubtSummaryView; expiresAt: number }
  >();

  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly conversations: ConversationsService,
    private readonly users: UsersService,
    private readonly groq: GroqClient,
  ) {}

  async summarise(user: AuthUser, conversationId: Types.ObjectId): Promise<DoubtSummaryView> {
    const { conversation } = await this.conversations.requireAccess(user, conversationId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Doubts exist only in program groups');
    }
    if (!canResolveDoubts(user.role, conversation.type)) {
      throw new ForbiddenException('Only mentors and admins can summarise doubts');
    }

    const filter = { conversationId, 'doubt.status': 'open', deletedAt: null };
    const [rows, openCount] = await Promise.all([
      this.messageModel.find(filter).sort({ _id: -1 }).limit(MAX_DOUBTS).lean(),
      this.messageModel.countDocuments(filter),
    ]);
    if (rows.length === 0) return emptySummary();
    if (!this.groq.isConfigured()) {
      throw new ServiceUnavailableException('AI summaries are not set up on this server.');
    }

    const doubts = await this.describe(rows.reverse());
    const cacheKey = createHash('sha256')
      .update(
        JSON.stringify(doubts.map(({ messageId, text, replies }) => [messageId, text, replies])),
      )
      .digest('hex');
    const cached = this.cache.get(conversationId.toHexString());
    if (cached && cached.key === cacheKey && cached.expiresAt > Date.now()) return cached.view;

    const raw = await this.generate(
      buildDoubtPrompt(conversation.name ?? 'Group', doubts, new Date()),
    );
    const summary = reconcileSummary(raw, doubts);
    if (!summary) throw new BadGatewayException(GENERATION_FAILED);

    const view: DoubtSummaryView = {
      status: 'ready',
      doubtCount: doubts.length,
      omittedCount: openCount - doubts.length,
      overview: summary.overview,
      topics: summary.topics.map(({ title, summary: text, doubts: items }) => ({
        title,
        summary: text,
        doubts: items.map(({ messageId, askedBy, askedAt, text: preview }) => ({
          messageId,
          askedBy,
          askedAt,
          preview: preview.slice(0, 160),
        })),
      })),
      generatedAt: new Date(),
      model: this.groq.model,
    };
    this.cache.set(conversationId.toHexString(), {
      key: cacheKey,
      view,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return view;
  }

  // Sends display names and message text only; emails and other details never leave the server.
  private async describe(doubts: StoredMessage[]): Promise<DoubtForSummary[]> {
    const replies = await this.messageModel
      .find({ 'replyTo.messageId': { $in: doubts.map((d) => d._id) }, deletedAt: null })
      .sort({ _id: 1 })
      .lean();
    const people = new Map(
      (
        await this.users.findByIds(
          [...doubts, ...replies].flatMap((m) => (m.senderId ? [m.senderId] : [])),
        )
      ).map((u) => [u._id.toHexString(), u]),
    );
    const nameOf = (message: StoredMessage) =>
      (message.senderId && people.get(message.senderId.toHexString())?.name) ??
      message.import?.senderName ??
      'A former member';

    return doubts.map((doubt, index) => ({
      ref: `d${index + 1}`,
      messageId: doubt._id.toHexString(),
      askedBy: nameOf(doubt),
      askedAt: doubt.createdAt,
      text: describeContent(doubt),
      replies: replies
        .filter((reply) => reply.replyTo?.messageId.equals(doubt._id))
        .slice(0, MAX_REPLIES_PER_DOUBT)
        .map((reply) => ({
          author: nameOf(reply),
          role: (reply.senderId && people.get(reply.senderId.toHexString())?.role) || 'member',
          text: describeContent(reply),
        })),
    }));
  }

  private async generate(prompt: string): Promise<unknown> {
    try {
      return await this.groq.generateJson({
        systemInstruction: SUMMARY_INSTRUCTION,
        prompt,
        schema: SUMMARY_SCHEMA,
      });
    } catch (error) {
      if (!(error instanceof GroqError)) throw error;
      if (error.failure === 'not-configured') {
        throw new ServiceUnavailableException('AI summaries are not set up on this server.');
      }
      if (error.failure === 'rate-limited') {
        throw new HttpException(
          'The AI service is busy right now. Please try again in a minute.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadGatewayException(GENERATION_FAILED);
    }
  }
}

const GENERATION_FAILED =
  'The AI summary could not be generated right now. Please try again later.';

function emptySummary(): DoubtSummaryView {
  return {
    status: 'empty',
    doubtCount: 0,
    omittedCount: 0,
    overview: '',
    topics: [],
    generatedAt: null,
    model: null,
  };
}

/** The model cannot see files, so it is told one was attached rather than left guessing. */
function describeContent(message: StoredMessage): string {
  const text = message.text.slice(0, TEXT_LIMIT);
  if (!message.attachment) return text;
  const kind = message.type === 'image' ? 'an image' : 'a file';
  const note = `(attached ${kind} the AI cannot see: ${message.attachment.name})`;
  return text ? `${text} ${note}` : note;
}
