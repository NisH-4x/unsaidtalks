import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { readFile } from 'fs/promises';
import { Connection, Model, Types } from 'mongoose';
import { join } from 'path';
import { hashPassword } from '../../common/security/password';
import { EnvironmentVariables } from '../../config/env.validation';
import { AttachmentStorage } from '../../modules/attachments/attachment-storage.service';
import { detectAttachmentType, isImage } from '../../modules/attachments/attachment-types';
import {
  Conversation,
  ConversationType,
  directKeyFor,
} from '../../modules/conversations/schemas/conversation.schema';
import { Membership } from '../../modules/conversations/schemas/membership.schema';
import { buildMessagePreview } from '../../modules/messages/message-preview';
import { Attachment, Message } from '../../modules/messages/schemas/message.schema';
import { Report } from '../../modules/moderation/schemas/report.schema';
import {
  Notification,
  NotificationType,
} from '../../modules/notifications/schemas/notification.schema';
import { User, UserRole } from '../../modules/users/schemas/user.schema';
import {
  DEMO_PASSWORD,
  Gap,
  SEED_DIRECT_CHATS,
  SEED_GROUPS,
  SEED_MENTOR_APPLICANTS,
  SEED_REPORTS,
  SEED_USERS,
  SeedDirectChat,
  SeedGroup,
  SeedMessage,
  SeedUserKey,
} from './seed-data';

const DEFAULT_GAP: Gap = '3m';
const ASSETS_DIR = join(__dirname, 'assets');
const GAP_UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

interface SeededUser {
  _id: Types.ObjectId;
  name: string;
  role: UserRole;
}

type MessageRecord = Message & { _id: Types.ObjectId };

interface SeededMessage {
  record: MessageRecord;
  senderKey: SeedUserKey;
  key?: string;
  replyTo?: SeededMessage;
  resolves?: SeededMessage;
}

interface SeededConversation {
  id: Types.ObjectId;
  type: ConversationType;
  label: string;
  memberKeys: SeedUserKey[];
  messages: SeededMessage[];
}

interface ReadPosition {
  lastReadIndex: number;
  unreadCount: number;
}

export interface SeedSummary {
  users: number;
  mentorApplicants: number;
  groups: number;
  directChats: number;
  memberships: number;
  messages: number;
  notifications: number;
  reports: number;
}

@Injectable()
export class SeedService {
  private readonly now = Date.now();
  private readonly users = new Map<SeedUserKey, SeededUser>();
  private readonly lastReadIndex = new Map<SeededConversation, Map<SeedUserKey, number>>();

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    @InjectModel(Report.name) private readonly reportModel: Model<Report>,
    private readonly storage: AttachmentStorage,
  ) {}

  async run(): Promise<SeedSummary> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new Error('Refusing to seed while NODE_ENV=production.');
    }

    await this.resetCollections();
    await this.createUsers();

    const conversations: SeededConversation[] = [];
    for (const group of SEED_GROUPS) conversations.push(await this.seedGroup(group));
    for (const chat of SEED_DIRECT_CHATS) conversations.push(await this.seedDirectChat(chat));

    const notifications = await this.createNotifications(conversations);
    const reports = await this.createReports(conversations);

    return {
      users: this.users.size,
      mentorApplicants: SEED_MENTOR_APPLICANTS.length,
      groups: SEED_GROUPS.length,
      directChats: SEED_DIRECT_CHATS.length,
      memberships: conversations.reduce((sum, c) => sum + c.memberKeys.length, 0),
      messages: conversations.reduce((sum, c) => sum + c.messages.length, 0),
      notifications,
      reports,
    };
  }

  /**
   * Re-reads the seeded data and recomputes each member's unread count from the
   * messages themselves. This also proves that message _id order matches send order,
   * which cursor pagination relies on.
   */
  async verify(): Promise<string[]> {
    const problems: string[] = [];

    const messages = await this.messageModel
      .find({}, { conversationId: 1, createdAt: 1 })
      .sort({ conversationId: 1, _id: 1 })
      .lean();
    messages.forEach((message, index) => {
      const previous = messages[index - 1];
      if (
        previous?.conversationId.equals(message.conversationId) &&
        previous.createdAt > message.createdAt
      ) {
        problems.push(`Message ${message._id.toHexString()} is out of chronological order`);
      }
    });

    const memberships = await this.membershipModel.find().lean();
    for (const membership of memberships) {
      const unread = await this.messageModel.countDocuments({
        conversationId: membership.conversationId,
        senderId: { $ne: membership.userId },
        type: { $ne: 'system' },
        deletedAt: null,
        ...(membership.lastReadMessageId && { _id: { $gt: membership.lastReadMessageId } }),
      });
      if (unread !== membership.unreadCount) {
        problems.push(
          `Membership ${membership._id.toHexString()} stores ${membership.unreadCount} unread, actual ${unread}`,
        );
      }
    }

    const withFiles = await this.messageModel.find({ attachment: { $ne: null } }).lean();
    for (const { _id, attachment } of withFiles) {
      if (attachment && (await this.storage.sizeOf(attachment.fileId)) !== attachment.size) {
        problems.push(`Message ${_id.toHexString()} points to a missing or incomplete file`);
      }
    }

    return problems;
  }

  /** Empties every collection, including the GridFS ones that hold attachments. */
  private async resetCollections(): Promise<void> {
    const collections = (await this.connection.db?.collections()) ?? [];
    for (const collection of collections) await collection.deleteMany({});
    await this.connection.syncIndexes();
  }

  private async createUsers(): Promise<void> {
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    const created = await this.userModel.insertMany(
      SEED_USERS.map(({ name, email, role }) => ({ name, email, role, passwordHash })),
    );
    created.forEach((doc, index) => {
      this.users.set(SEED_USERS[index].key, { _id: doc._id, name: doc.name, role: doc.role });
    });

    await this.userModel.insertMany(
      SEED_MENTOR_APPLICANTS.map(({ name, email }) => ({
        name,
        email,
        role: 'mentor',
        status: 'pending_approval',
        passwordHash,
      })),
    );
  }

  private async seedGroup(group: SeedGroup): Promise<SeededConversation> {
    const admin = this.user('admin');
    const id = new Types.ObjectId();
    const createdNote: SeedMessage = {
      from: 'admin',
      system: true,
      text: `${admin.name} created this group`,
    };
    const messages = await this.buildMessages(id, [createdNote, ...group.messages], group.endsAgo);
    const createdAt = messages[0].record.createdAt;

    await this.conversationModel.create({
      _id: id,
      type: 'group',
      name: group.name,
      program: group.program,
      batch: group.batch,
      description: group.description,
      allowMenteeDirectChat: group.allowMenteeDirectChat ?? false,
      createdBy: admin._id,
      ...this.activityFields(messages),
      createdAt,
      updatedAt: createdAt,
    });

    const conversation: SeededConversation = {
      id,
      type: 'group',
      label: group.name,
      memberKeys: [...group.mentors, ...group.mentees],
      messages,
    };
    await this.persistMessagesAndMembers(conversation, group.unread, admin._id);
    return conversation;
  }

  private async seedDirectChat(chat: SeedDirectChat): Promise<SeededConversation> {
    const id = new Types.ObjectId();
    const [first, second] = chat.participants.map((key) => this.user(key));
    const messages = await this.buildMessages(id, chat.messages, chat.endsAgo);
    const createdAt = messages[0].record.createdAt;

    await this.conversationModel.create({
      _id: id,
      type: 'direct',
      participantIds: [first._id, second._id],
      directKey: directKeyFor(first._id, second._id),
      ...this.activityFields(messages),
      createdAt,
      updatedAt: createdAt,
    });

    const conversation: SeededConversation = {
      id,
      type: 'direct',
      label: `${first.name} ↔ ${second.name}`,
      memberKeys: [...chat.participants],
      messages,
    };
    await this.persistMessagesAndMembers(conversation, chat.unread, null);
    return conversation;
  }

  private async persistMessagesAndMembers(
    conversation: SeededConversation,
    unread: SeedGroup['unread'],
    addedBy: Types.ObjectId | null,
  ): Promise<void> {
    const { messages } = conversation;
    const joinedAt = messages[0].record.createdAt;
    await this.messageModel.insertMany(messages.map((message) => message.record));

    const readIndexes = new Map<SeedUserKey, number>();
    const memberships = conversation.memberKeys.map((key) => {
      const position = this.readPosition(conversation, key, unread?.[key] ?? 0);
      readIndexes.set(key, position.lastReadIndex);

      return {
        conversationId: conversation.id,
        userId: this.user(key)._id,
        unreadCount: position.unreadCount,
        lastReadMessageId: messages[position.lastReadIndex]?.record._id ?? null,
        addedBy,
        createdAt: joinedAt,
        updatedAt: joinedAt,
      };
    });

    await this.membershipModel.insertMany(memberships);
    this.lastReadIndex.set(conversation, readIndexes);
  }

  private async buildMessages(
    conversationId: Types.ObjectId,
    sources: SeedMessage[],
    endsAgo: Gap,
  ): Promise<SeededMessage[]> {
    const timestamps = this.timeline(sources, endsAgo);
    const byKey = new Map<string, SeededMessage>();

    const messages: SeededMessage[] = [];
    for (const [index, source] of sources.entries()) {
      const message = await this.buildMessage(conversationId, source, timestamps[index], byKey);
      if (source.key) byKey.set(source.key, message);
      messages.push(message);
    }

    sources.forEach((source, index) => {
      if (source.doubt === 'resolved') this.resolveDoubt(messages[index], messages);
    });

    return messages;
  }

  private async buildMessage(
    conversationId: Types.ObjectId,
    source: SeedMessage,
    createdAt: Date,
    earlierByKey: Map<string, SeededMessage>,
  ): Promise<SeededMessage> {
    const sender = this.user(source.from);
    const replyTo = source.replyTo ? earlierByKey.get(source.replyTo) : undefined;
    if (source.replyTo && !replyTo) {
      throw new Error(`A message replies to "${source.replyTo}", which is unknown or not earlier`);
    }
    const attachment = source.attachment
      ? await this.storeAsset(source.attachment, conversationId, sender._id)
      : null;

    const record: MessageRecord = {
      _id: new Types.ObjectId(),
      conversationId,
      senderId: sender._id,
      type: source.system ? 'system' : contentType(attachment),
      text: source.deleted ? '' : source.text,
      attachment,
      replyTo: replyTo ? this.replySnapshot(replyTo) : null,
      isAnnouncement: source.announcement ?? false,
      pin: source.pinned ? { pinnedBy: sender._id, pinnedAt: this.shortlyAfter(createdAt) } : null,
      doubt: source.doubt
        ? { status: 'open', markedAt: createdAt, resolvedBy: null, resolvedAt: null }
        : null,
      reactions: Object.entries(source.reactions ?? {}).flatMap(([emoji, keys]) =>
        keys.map((key) => ({ userId: this.user(key)._id, emoji })),
      ),
      editedAt: null,
      import: null,
      deletedAt: source.deleted ? this.shortlyAfter(createdAt) : null,
      deletedBy: source.deleted ? sender._id : null,
      createdAt,
      updatedAt: createdAt,
    };

    return { record, senderKey: source.from, key: source.key, replyTo };
  }

  // A resolved doubt is closed by the first mentor reply to it, at the time of that reply.
  private resolveDoubt(doubt: SeededMessage, messages: SeededMessage[]): void {
    const answer = messages.find((m) => m.replyTo === doubt && this.canResolveDoubts(m.senderKey));
    if (!answer) {
      throw new Error(`Resolved doubt "${doubt.record.text}" needs a reply from a mentor`);
    }

    doubt.record.doubt = {
      status: 'resolved',
      markedAt: doubt.record.createdAt,
      resolvedBy: answer.record.senderId,
      resolvedAt: answer.record.createdAt,
    };
    answer.resolves = doubt;
  }

  private async storeAsset(
    fileName: string,
    conversationId: Types.ObjectId,
    uploadedBy: Types.ObjectId,
  ): Promise<Attachment> {
    const content = await readFile(join(ASSETS_DIR, fileName));
    const mimeType = detectAttachmentType(content);
    if (!mimeType) throw new Error(`Seed asset "${fileName}" is not a supported image or PDF`);

    const fileId = await this.storage.save(content, fileName, {
      mimeType,
      conversationId,
      uploadedBy,
    });
    const dimensions = mimeType === 'image/png' ? pngDimensions(content) : null;
    return {
      fileId,
      name: fileName,
      mimeType,
      size: content.length,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    };
  }

  private replySnapshot(replied: SeededMessage): Message['replyTo'] {
    return {
      messageId: replied.record._id,
      senderId: replied.record.senderId,
      senderName: this.user(replied.senderKey).name,
      type: replied.record.type,
      preview: buildMessagePreview(replied.record),
      isDeleted: replied.record.deletedAt !== null,
    };
  }

  private activityFields(messages: SeededMessage[]) {
    const last = messages[messages.length - 1];

    return {
      lastMessage: {
        messageId: last.record._id,
        senderId: last.record.senderId,
        senderName: this.user(last.senderKey).name,
        type: last.record.type,
        preview: buildMessagePreview(last.record),
        sentAt: last.record.createdAt,
      },
      lastActivityAt: last.record.createdAt,
    };
  }

  // Someone who sent a message has read everything before it, so unread
  // messages can only come after the member's own latest message.
  private readPosition(
    conversation: SeededConversation,
    memberKey: SeedUserKey,
    unread: number,
  ): ReadPosition {
    const { messages } = conversation;
    if (unread === 0) return { lastReadIndex: messages.length - 1, unreadCount: 0 };

    const lastOwnIndex = messages.findLastIndex(
      (m) => m.senderKey === memberKey && m.record.type !== 'system',
    );
    const unreadIndexes = messages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => countsAsUnread(message.record) && message.senderKey !== memberKey)
      .map(({ index }) => index)
      .slice(-unread);

    if (unreadIndexes.length < unread || unreadIndexes[0] <= lastOwnIndex) {
      throw new Error(
        `${conversation.label}: ${memberKey} cannot have ${unread} unread messages ` +
          'because they sent a message more recently than that.',
      );
    }

    return { lastReadIndex: unreadIndexes[0] - 1, unreadCount: unread };
  }

  private async createNotifications(conversations: SeededConversation[]): Promise<number> {
    const notifications: Notification[] = [];

    for (const conversation of conversations) {
      const readIndexes = this.lastReadIndex.get(conversation) ?? new Map<SeedUserKey, number>();

      const notify = (
        recipient: SeedUserKey,
        type: NotificationType,
        trigger: SeededMessage,
        subject: SeededMessage,
      ) => {
        const seen = (readIndexes.get(recipient) ?? -1) >= conversation.messages.indexOf(trigger);

        notifications.push({
          userId: this.user(recipient)._id,
          type,
          conversationId: conversation.id,
          messageId: subject.record._id,
          actorId: this.user(trigger.senderKey)._id,
          preview: buildMessagePreview(subject.record),
          readAt: seen ? this.shortlyAfter(trigger.record.createdAt) : null,
          createdAt: trigger.record.createdAt,
        });
      };

      for (const message of conversation.messages) {
        const { replyTo, resolves } = message;

        if (replyTo && replyTo.senderKey !== message.senderKey) {
          notify(replyTo.senderKey, 'reply', message, message);
        }
        if (resolves) {
          notify(resolves.senderKey, 'doubt_resolved', message, resolves);
        }
        if (message.record.isAnnouncement) {
          for (const member of conversation.memberKeys) {
            if (member !== message.senderKey) notify(member, 'announcement', message, message);
          }
        }
      }
    }

    // Inserted oldest first so that _id order matches creation time, as for messages.
    notifications.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    await this.notificationModel.insertMany(notifications);
    return notifications.length;
  }

  private async createReports(conversations: SeededConversation[]): Promise<number> {
    const reports = SEED_REPORTS.map((report) => {
      const matches = conversations.flatMap((conversation) =>
        conversation.messages
          .filter((message) => message.key === report.message)
          .map((message) => ({ conversation, message })),
      );
      if (matches.length !== 1) {
        throw new Error(`A report must point to exactly one message keyed "${report.message}"`);
      }

      const [{ conversation, message }] = matches;
      if (!conversation.memberKeys.includes(report.by)) {
        throw new Error(`${report.by} is not a member of ${conversation.label}`);
      }

      const reportedAt = new Date(
        Math.min(message.record.createdAt.getTime() + GAP_UNIT_MS.h, this.now),
      );

      return {
        messageId: message.record._id,
        conversationId: conversation.id,
        reportedBy: this.user(report.by)._id,
        reason: report.reason,
        note: report.note,
        messageSnapshot: {
          senderId: this.user(message.senderKey)._id,
          senderName: this.user(message.senderKey).name,
          type: message.record.type,
          text: message.record.text,
          attachment: message.record.attachment,
          sentAt: message.record.createdAt,
        },
        createdAt: reportedAt,
        updatedAt: reportedAt,
      };
    });

    await this.reportModel.insertMany(reports);
    return reports.length;
  }

  private timeline(sources: SeedMessage[], endsAgo: Gap): Date[] {
    const gaps = sources.map((source, index) =>
      index === 0 ? 0 : gapToMs(source.after ?? DEFAULT_GAP),
    );
    const span = gaps.reduce((sum, gap) => sum + gap, 0);
    let time = this.now - gapToMs(endsAgo) - span;

    return gaps.map((gap) => {
      time += gap;
      return new Date(time);
    });
  }

  private shortlyAfter(date: Date): Date {
    return new Date(Math.min(date.getTime() + GAP_UNIT_MS.m, this.now));
  }

  private canResolveDoubts(key: SeedUserKey): boolean {
    const { role } = this.user(key);
    return role === 'mentor' || role === 'admin';
  }

  private user(key: SeedUserKey): SeededUser {
    const user = this.users.get(key);
    if (!user) throw new Error(`Unknown seed user "${key}"`);
    return user;
  }
}

function gapToMs(gap: Gap): number {
  const unit = gap.slice(-1) as keyof typeof GAP_UNIT_MS;
  return Number(gap.slice(0, -1)) * GAP_UNIT_MS[unit];
}

function contentType(attachment: Attachment | null): 'text' | 'image' | 'file' {
  if (!attachment) return 'text';
  return isImage(attachment.mimeType) ? 'image' : 'file';
}

// A PNG starts with its IHDR chunk, which stores the width and height at bytes 16-23.
function pngDimensions(content: Buffer): { width: number; height: number } {
  return { width: content.readUInt32BE(16), height: content.readUInt32BE(20) };
}

function countsAsUnread(message: Message): boolean {
  return message.type !== 'system' && message.deletedAt === null;
}
