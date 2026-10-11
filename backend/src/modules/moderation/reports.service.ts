import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/database/duplicate-key';
import { canReportMessage } from '../access/access-policy';
import { AuthUser } from '../auth/auth-user';
import { ConversationsService } from '../conversations/conversations.service';
import { MessageDeletionService } from '../messages/message-deletion.service';
import { Attachment, Message } from '../messages/schemas/message.schema';
import { toAdminUserView } from '../users/user.views';
import { UsersService } from '../users/users.service';
import { ReportDecision, ReportMessageDto } from './dto/report.dto';
import { ReportedMessageView } from './report.views';
import { Report, ReportStatus } from './schemas/report.schema';

type StoredReport = Report & { _id: Types.ObjectId };

const LIST_LIMIT = 200;

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private readonly reportModel: Model<Report>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly conversations: ConversationsService,
    private readonly users: UsersService,
    private readonly deletion: MessageDeletionService,
  ) {}

  /** Files a report with a copy of the message, so admins can review it even after deletion. */
  async report(
    user: AuthUser,
    messageId: Types.ObjectId,
    { reason, note }: ReportMessageDto,
  ): Promise<{ id: string }> {
    const message = await this.messageModel.findById(messageId).lean();
    const conversation = message && (await this.visibleConversation(user, message.conversationId));
    if (!message || !conversation) throw new NotFoundException('Message not found');
    if (message.type === 'system') throw new BadRequestException('System notes cannot be reported');
    if (message.deletedAt) throw new BadRequestException('This message was deleted');

    const isSender = message.senderId?.equals(user.id) ?? false;
    if (!canReportMessage({ role: user.role, conversationType: conversation.type, isSender })) {
      throw new ForbiddenException(
        isSender
          ? 'You cannot report your own message'
          : 'Admins can delete messages directly instead of reporting them',
      );
    }

    const sender = message.senderId ? await this.users.findById(message.senderId) : null;
    try {
      const report = await this.reportModel.create({
        messageId,
        conversationId: message.conversationId,
        reportedBy: user.id,
        reason,
        note: note ?? '',
        messageSnapshot: {
          senderId: message.senderId,
          senderName: sender?.name ?? message.import?.senderName ?? '',
          type: message.type,
          text: message.text,
          attachment: message.attachment,
          sentAt: message.createdAt,
        },
      });
      return { id: report._id.toHexString() };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('You have already reported this message');
      }
      throw error;
    }
  }

  async listForAdmin(status: ReportStatus): Promise<ReportedMessageView[]> {
    const reports = await this.reportModel
      .find({ status })
      .sort({ _id: -1 })
      .limit(LIST_LIMIT)
      .lean();
    return this.present(reports);
  }

  /** Messages that have at least one report waiting for review. */
  async countOpen(): Promise<number> {
    const messageIds = await this.reportModel.distinct('messageId', { status: 'open' });
    return messageIds.length;
  }

  /** Closes every open report about a message, removing the message if the admin decides so. */
  async decide(
    admin: AuthUser,
    messageId: Types.ObjectId,
    decision: ReportDecision,
  ): Promise<ReportedMessageView> {
    const open = await this.reportModel.find({ messageId, status: 'open' }).lean();
    if (open.length === 0)
      throw new NotFoundException('There are no open reports for this message');

    if (decision === 'remove-message') await this.deletion.removeReported(admin, messageId);
    const status: ReportStatus = decision === 'dismiss' ? 'dismissed' : 'actioned';
    await this.reportModel
      .updateMany(
        { _id: { $in: open.map((report) => report._id) } },
        { status, reviewedBy: admin.id, reviewedAt: new Date() },
      )
      .exec();

    const reviewed = await this.reportModel.find({ messageId, status }).sort({ _id: -1 }).lean();
    const [view] = await this.present(reviewed);
    return view;
  }

  /** The file of a reported message, which stays available to admins after deletion. */
  async reportedAttachment(messageId: Types.ObjectId): Promise<Attachment> {
    const report = await this.reportModel
      .findOne({ messageId, 'messageSnapshot.attachment': { $ne: null } })
      .lean();
    const attachment = report?.messageSnapshot.attachment;
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  /** Groups reports by message (newest report first) and adds the people and chats involved. */
  private async present(reports: StoredReport[]): Promise<ReportedMessageView[]> {
    const byMessage = new Map<string, StoredReport[]>();
    for (const report of reports) {
      const key = report.messageId.toHexString();
      byMessage.set(key, [...(byMessage.get(key) ?? []), report]);
    }
    const firstReports = [...byMessage.values()].map((group) => group[group.length - 1]);

    const conversations = new Map(
      (await this.conversations.findSummaries(firstReports.map((r) => r.conversationId))).map(
        (c) => [c._id.toHexString(), c],
      ),
    );
    const userIds = [
      ...reports.flatMap((r) => [
        r.reportedBy,
        ...(r.messageSnapshot.senderId ? [r.messageSnapshot.senderId] : []),
      ]),
      ...reports.flatMap((r) => (r.reviewedBy ? [r.reviewedBy] : [])),
      ...[...conversations.values()].flatMap((c) => c.participantIds ?? []),
    ];
    const people = new Map(
      (await this.users.findByIds(userIds)).map((u) => [u._id.toHexString(), u]),
    );
    const personView = (id: Types.ObjectId | null) => {
      const person = id && people.get(id.toHexString());
      return person ? toAdminUserView(person) : null;
    };
    const deleted = new Set(
      (
        await this.messageModel
          .find({ _id: { $in: firstReports.map((r) => r.messageId) }, deletedAt: { $ne: null } })
          .select({ _id: 1 })
          .lean()
      ).map((m) => m._id.toHexString()),
    );

    return [...byMessage.entries()].map(([messageId, group]) => {
      const {
        messageSnapshot: snapshot,
        conversationId,
        status,
        reviewedBy,
        reviewedAt,
      } = group[group.length - 1];
      const conversation = conversations.get(conversationId.toHexString());
      const participants = (conversation?.participantIds ?? [])
        .flatMap((id) => people.get(id.toHexString())?.name ?? [])
        .sort((a, b) => a.localeCompare(b));

      return {
        messageId,
        status,
        conversation: {
          id: conversationId.toHexString(),
          type: conversation?.type ?? 'group',
          title:
            conversation?.type === 'direct'
              ? `Private chat: ${participants.join(' and ')}`
              : (conversation?.name ?? 'Deleted conversation'),
        },
        message: {
          sender: personView(snapshot.senderId),
          senderName: snapshot.senderName,
          type: snapshot.type,
          text: snapshot.text,
          attachment: snapshot.attachment
            ? {
                name: snapshot.attachment.name,
                mimeType: snapshot.attachment.mimeType,
                size: snapshot.attachment.size,
              }
            : null,
          sentAt: snapshot.sentAt,
          isDeleted: deleted.has(messageId),
        },
        reports: group.map((report) => ({
          id: report._id.toHexString(),
          reason: report.reason,
          note: report.note,
          reportedBy: personView(report.reportedBy),
          createdAt: report.createdAt,
        })),
        reviewedBy: personView(reviewedBy),
        reviewedAt,
      };
    });
  }

  private async visibleConversation(user: AuthUser, conversationId: Types.ObjectId) {
    try {
      return (await this.conversations.requireAccess(user, conversationId)).conversation;
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
}
