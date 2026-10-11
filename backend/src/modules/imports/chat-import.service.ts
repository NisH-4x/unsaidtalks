import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/database/duplicate-key';
import { AuthUser } from '../auth/auth-user';
import { ConversationEvent, HistoryImportedEvent } from '../conversations/conversation.events';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { Message, MESSAGE_TEXT_MAX_LENGTH } from '../messages/schemas/message.schema';
import { PublicUserView, toPublicUserView } from '../users/user.views';
import { UsersService } from '../users/users.service';
import { ImportChatDto, ImportOptionsDto } from './dto/chat-import.dto';
import { ChatImportView, ImportPreviewView } from './chat-import.views';
import { historicalIdFactory } from './historical-id';
import { ChatImport } from './schemas/chat-import.schema';
import {
  ParsedMessage,
  ParseResult,
  parseWhatsAppExport,
  privateSenderName,
} from './whatsapp-parser';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_MESSAGES = 20_000;
const SAMPLE_SIZE = 5;
const PROBLEMS_SHOWN = 20;

export interface UploadedExport {
  buffer: Buffer;
  originalname: string;
}

const normaliseName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/**
 * Brings the history of a WhatsApp group into a program group. Senders are linked to
 * members only as the admin confirms; everything imported stays marked as imported.
 */
@Injectable()
export class ChatImportService {
  constructor(
    @InjectModel(ChatImport.name) private readonly importModel: Model<ChatImport>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly conversations: ConversationsService,
    private readonly users: UsersService,
    private readonly messages: MessagesService,
    private readonly events: EventEmitter2,
  ) {}

  async preview(
    groupId: Types.ObjectId,
    file: UploadedExport,
    options: ImportOptionsDto,
  ): Promise<ImportPreviewView> {
    await this.requireGroup(groupId);
    const parsed = this.parse(file, options);
    const members = await this.members(groupId);
    const previous = await this.importModel
      .findOne({ conversationId: groupId, fileHash: sha256(file.buffer) })
      .lean();
    const duplicateCount = await this.messageModel.countDocuments({
      conversationId: groupId,
      'import.fingerprint': { $in: fingerprintsOf(parsed.messages) },
    });

    return {
      fileName: file.originalname,
      dateOrder: parsed.dateOrder,
      dateOrderIsAmbiguous: parsed.dateOrderIsAmbiguous,
      messageCount: parsed.messages.length,
      firstMessageAt: parsed.messages[0].sentAt,
      lastMessageAt: parsed.messages[parsed.messages.length - 1].sentAt,
      senders: summariseSenders(parsed.messages, members),
      members,
      sample: parsed.messages
        .slice(0, SAMPLE_SIZE)
        .map(({ sentAt, sender, text }) => ({ sentAt, sender, text })),
      problems: parsed.problems.slice(0, PROBLEMS_SHOWN),
      problemCount: parsed.problems.length,
      skippedLines: parsed.skippedLines,
      alreadyImported: previous
        ? { importedAt: previous.createdAt, importedCount: previous.importedCount }
        : null,
      duplicateCount,
    };
  }

  async import(
    admin: AuthUser,
    groupId: Types.ObjectId,
    file: UploadedExport,
    dto: ImportChatDto,
  ): Promise<ChatImportView> {
    await this.requireGroup(groupId);
    const parsed = this.parse(file, dto);
    const members = await this.members(groupId);
    const linkedTo = readMapping(dto.mapping, new Set(members.map((m) => m.id)));

    const record = await this.claimFile(admin, groupId, file, parsed.messages);
    try {
      const fingerprints = fingerprintsOf(parsed.messages);
      const alreadyHere = new Set(
        (
          await this.messageModel
            .find(
              { conversationId: groupId, 'import.fingerprint': { $in: fingerprints } },
              { 'import.fingerprint': 1 },
            )
            .lean()
        ).map((m) => m.import?.fingerprint),
      );

      const idFor = historicalIdFactory();
      const documents = parsed.messages.flatMap((message, index) =>
        alreadyHere.has(fingerprints[index])
          ? []
          : [
              {
                _id: idFor(message.sentAt, index),
                conversationId: groupId,
                senderId: linkedTo.get(message.sender) ?? null,
                type: 'text',
                text: message.text,
                import: {
                  source: 'whatsapp',
                  senderName: message.sender,
                  batchId: record._id,
                  fingerprint: fingerprints[index],
                },
                createdAt: message.sentAt,
                updatedAt: message.sentAt,
              },
            ],
      );
      record.importedCount = await this.insertNew(documents);
      record.skippedCount = parsed.messages.length - record.importedCount;
      await record.save();
    } catch (error) {
      await this.importModel.deleteOne({ _id: record._id }).exec();
      throw error;
    }

    if (record.importedCount > 0) {
      await this.messages.createSystemMessage(
        groupId.toHexString(),
        { id: admin.id, name: admin.name },
        `${admin.name} imported ${record.importedCount} messages from a WhatsApp chat`,
      );
      await this.events.emitAsync(ConversationEvent.HistoryImported, {
        conversationId: groupId.toHexString(),
      } satisfies HistoryImportedEvent);
    }
    const [view] = await this.present([record.toObject()]);
    return view;
  }

  async list(groupId: Types.ObjectId): Promise<ChatImportView[]> {
    await this.requireGroup(groupId);
    const records = await this.importModel
      .find({ conversationId: groupId })
      .sort({ _id: -1 })
      .lean();
    return this.present(records);
  }

  private parse(file: UploadedExport, options: ImportOptionsDto): ParseResult {
    const content = file.buffer;
    if (content.length === 0) throw new BadRequestException('The file is empty');
    if (content[0] === 0x50 && content[1] === 0x4b) {
      throw new BadRequestException(
        'This looks like a .zip export. Export the chat "without media" and upload the .txt file.',
      );
    }
    if (content.includes(0)) {
      throw new BadRequestException('This is not a text file. Upload the exported .txt chat.');
    }

    const parsed = parseWhatsAppExport(content.toString('utf8'), {
      dateOrder: options.dateOrder,
      timezoneOffsetMinutes: options.timezoneOffsetMinutes,
      now: new Date(),
      maxTextLength: MESSAGE_TEXT_MAX_LENGTH,
    });
    if (parsed.messages.length === 0) {
      throw new BadRequestException(
        'No messages were found. Upload a chat exported from WhatsApp as a .txt file.',
      );
    }
    if (parsed.messages.length > MAX_IMPORT_MESSAGES) {
      throw new BadRequestException(
        `An import can hold at most ${MAX_IMPORT_MESSAGES.toLocaleString('en')} messages.`,
      );
    }
    return {
      ...parsed,
      messages: parsed.messages.map((m) => ({ ...m, sender: privateSenderName(m.sender) })),
    };
  }

  /** Records the file first: its unique hash stops the same export being imported twice. */
  private async claimFile(
    admin: AuthUser,
    groupId: Types.ObjectId,
    file: UploadedExport,
    messages: ParsedMessage[],
  ) {
    try {
      return await this.importModel.create({
        conversationId: groupId,
        importedBy: admin.id,
        fileName: file.originalname.slice(0, 255),
        fileHash: sha256(file.buffer),
        importedCount: 0,
        skippedCount: 0,
        firstMessageAt: messages[0].sentAt,
        lastMessageAt: messages[messages.length - 1].sentAt,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('This file has already been imported into this group');
      }
      throw error;
    }
  }

  /** Inserts the messages, counting those another import added in the meantime as skipped. */
  private async insertNew(documents: object[]): Promise<number> {
    if (documents.length === 0) return 0;
    try {
      const inserted = await this.messageModel.insertMany(documents, { ordered: false });
      return inserted.length;
    } catch (error) {
      const partial = error as { insertedDocs?: unknown[]; writeErrors?: Array<{ code?: number }> };
      if (partial.writeErrors?.every((e) => e.code === 11000)) {
        return partial.insertedDocs?.length ?? 0;
      }
      throw error;
    }
  }

  private async requireGroup(groupId: Types.ObjectId): Promise<void> {
    const [conversation] = await this.conversations.findSummaries([groupId]);
    if (conversation?.type !== 'group') throw new NotFoundException('Group not found');
  }

  private async members(groupId: Types.ObjectId): Promise<PublicUserView[]> {
    const ids = await this.conversations.listMemberIds(groupId.toHexString());
    return (await this.users.findByIds(ids)).map(toPublicUserView);
  }

  private async present(
    records: Array<ChatImport & { _id: Types.ObjectId }>,
  ): Promise<ChatImportView[]> {
    const admins = new Map(
      (await this.users.findByIds(records.map((r) => r.importedBy))).map((u) => [
        u._id.toHexString(),
        toPublicUserView(u),
      ]),
    );
    return records.map((record) => ({
      id: record._id.toHexString(),
      fileName: record.fileName,
      importedBy: admins.get(record.importedBy.toHexString()) ?? null,
      importedCount: record.importedCount,
      skippedCount: record.skippedCount,
      firstMessageAt: record.firstMessageAt,
      lastMessageAt: record.lastMessageAt,
      createdAt: record.createdAt,
    }));
  }
}

/**
 * Identifies a message by its time, sender and text. Identical messages in the same minute
 * are told apart by how many came before, so an overlapping export matches the same ones.
 */
function fingerprintsOf(messages: ParsedMessage[]): string[] {
  const seen = new Map<string, number>();
  return messages.map(({ sentAt, sender, text }) => {
    const key = `${sentAt.toISOString()}|${sender}|${text}`;
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return sha256(`${key}|${occurrence}`).slice(0, 32);
  });
}

function summariseSenders(messages: ParsedMessage[], members: PublicUserView[]) {
  const counts = new Map<string, number>();
  for (const { sender } of messages) counts.set(sender, (counts.get(sender) ?? 0) + 1);
  const memberByName = new Map(members.map((m) => [normaliseName(m.name), m.id]));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, messageCount]) => ({
      name,
      messageCount,
      suggestedUserId: memberByName.get(normaliseName(name)) ?? null,
    }));
}

/** Sender links chosen by the admin; only members of this group can be linked. */
function readMapping(raw: string, memberIds: Set<string>): Map<string, Types.ObjectId> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('The sender links could not be read');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadRequestException('The sender links could not be read');
  }

  const links = new Map<string, Types.ObjectId>();
  for (const [sender, userId] of Object.entries(parsed)) {
    if (userId === null) continue;
    if (typeof userId !== 'string' || !isValidObjectId(userId) || !memberIds.has(userId)) {
      throw new BadRequestException('Senders can only be linked to members of this group');
    }
    links.set(sender, new Types.ObjectId(userId));
  }
  return links;
}
