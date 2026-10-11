import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/database/duplicate-key';
import {
  canMessageDirectly,
  canStartDirectChat,
  DirectChatFacts,
  DirectChatParty,
} from '../access/access-policy';
import { AuthUser } from '../auth/auth-user';
import { UserDocument } from '../users/schemas/user.schema';
import { ContactView, toContactView } from '../users/user.views';
import { UsersService } from '../users/users.service';
import { ConversationEvent, DirectChatCreatedEvent } from './conversation.events';
import { byRoleThenName } from './conversation.views';
import { Conversation, directKeyFor } from './schemas/conversation.schema';
import { Membership } from './schemas/membership.schema';

/** Someone the user may message privately, with their existing chat if there is one. */
export interface DirectContact extends ContactView {
  conversationId: string | null;
}

export interface OpenedDirectChat {
  conversationId: string;
  created: boolean;
}

const CONTACTS_LIMIT = 100;

function party(user: AuthUser | UserDocument): DirectChatParty {
  return 'status' in user
    ? { id: user._id.toHexString(), role: user.role, status: user.status }
    : { id: user.id, role: user.role, status: 'active' };
}

@Injectable()
export class DirectChatsService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  /** The people this user may start a private chat with, mentors first. */
  async listContacts(user: AuthUser, query?: string): Promise<DirectContact[]> {
    const candidates =
      user.role === 'admin'
        ? (await this.users.listForAdmin({ status: 'active', q: query })).filter(
            (candidate) => !candidate._id.equals(user.id),
          )
        : await this.groupContacts(user);

    const needle = query?.toLowerCase();
    const existing = await this.existingChatsByPartner(user.id);
    return candidates
      .filter((candidate) => !needle || candidate.name.toLowerCase().includes(needle))
      .map((candidate) => ({
        ...toContactView(candidate),
        conversationId: existing.get(candidate._id.toHexString()) ?? null,
      }))
      .sort(byRoleThenName)
      .slice(0, CONTACTS_LIMIT);
  }

  /** Returns the existing chat between the two people, or creates it if they may talk. */
  async open(initiator: AuthUser, recipientId: Types.ObjectId): Promise<OpenedDirectChat> {
    if (recipientId.equals(initiator.id)) {
      throw new BadRequestException("You can't start a chat with yourself");
    }
    const recipient = await this.users.findById(recipientId);
    if (!recipient || recipient.status !== 'active') {
      throw new NotFoundException('This person is not available');
    }

    const facts = await this.factsFor(initiator, recipient);
    if (!canStartDirectChat(facts)) throw new ForbiddenException(refusalReason(facts));

    const participantIds: [Types.ObjectId, Types.ObjectId] = [
      new Types.ObjectId(initiator.id),
      recipient._id,
    ];
    const directKey = directKeyFor(...participantIds);
    const existing = await this.conversationModel.findOne({ directKey }).lean();
    if (existing) {
      await this.ensureMemberships(existing._id, participantIds);
      return { conversationId: existing._id.toHexString(), created: false };
    }

    let chatId: Types.ObjectId;
    try {
      const chat = await this.conversationModel.create({
        type: 'direct',
        participantIds,
        directKey,
        createdBy: initiator.id,
      });
      chatId = chat._id;
    } catch (error) {
      // Both people pressed "Message" at the same moment: the unique key let one create win.
      const raced = isDuplicateKeyError(error)
        ? await this.conversationModel.findOne({ directKey }).lean()
        : null;
      if (!raced) throw error;
      await this.ensureMemberships(raced._id, participantIds);
      return { conversationId: raced._id.toHexString(), created: false };
    }

    await this.ensureMemberships(chatId, participantIds);
    await this.events.emitAsync(ConversationEvent.DirectCreated, {
      conversationId: chatId.toHexString(),
      initiatorId: initiator.id,
      participantIds: [participantIds[0].toHexString(), participantIds[1].toHexString()],
    } satisfies DirectChatCreatedEvent);
    return { conversationId: chatId.toHexString(), created: true };
  }

  /** Group conversations always allow sending; private chats need the relationship to hold. */
  async canSend(
    sender: AuthUser,
    conversation: Pick<Conversation, 'type' | 'participantIds'>,
  ): Promise<boolean> {
    if (conversation.type !== 'direct') return true;
    const partnerId = conversation.participantIds?.find((id) => !id.equals(sender.id));
    const partner = partnerId ? await this.users.findById(partnerId) : null;
    if (!partner) return false;
    return canMessageDirectly(await this.factsFor(sender, partner));
  }

  async assertCanSend(
    sender: AuthUser,
    conversation: Pick<Conversation, 'type' | 'participantIds'>,
  ): Promise<void> {
    if (!(await this.canSend(sender, conversation))) {
      throw new ForbiddenException(
        'You can no longer send messages here because you no longer share a program group.',
      );
    }
  }

  private async factsFor(initiator: AuthUser, recipient: UserDocument): Promise<DirectChatFacts> {
    return {
      initiator: party(initiator),
      recipient: party(recipient),
      sharedGroups: await this.sharedGroups(initiator.id, recipient._id),
    };
  }

  private async sharedGroups(
    userA: string,
    userB: Types.ObjectId,
  ): Promise<Array<{ allowMenteeDirectChat: boolean }>> {
    const conversationsOfA = await this.membershipModel.distinct('conversationId', {
      userId: userA,
    });
    const sharedIds = await this.membershipModel.distinct('conversationId', {
      userId: userB,
      conversationId: { $in: conversationsOfA },
    });
    return this.conversationModel
      .find({ _id: { $in: sharedIds }, type: 'group' }, { allowMenteeDirectChat: 1 })
      .lean();
  }

  /** Members of the user's groups whom the policy lets the user message. */
  private async groupContacts(user: AuthUser): Promise<UserDocument[]> {
    const myConversationIds = await this.membershipModel.distinct('conversationId', {
      userId: user.id,
    });
    const groups = await this.conversationModel
      .find({ _id: { $in: myConversationIds }, type: 'group' }, { allowMenteeDirectChat: 1 })
      .lean();
    const groupFlags = new Map(groups.map((g) => [g._id.toHexString(), g.allowMenteeDirectChat]));

    const memberships = await this.membershipModel
      .find(
        { conversationId: { $in: groups.map((g) => g._id) }, userId: { $ne: user.id } },
        { conversationId: 1, userId: 1 },
      )
      .lean();
    const sharedByPerson = new Map<string, Array<{ allowMenteeDirectChat: boolean }>>();
    for (const { userId, conversationId } of memberships) {
      const key = userId.toHexString();
      const shared = sharedByPerson.get(key) ?? [];
      shared.push({ allowMenteeDirectChat: groupFlags.get(conversationId.toHexString()) ?? false });
      sharedByPerson.set(key, shared);
    }

    const people = await this.users.findByIds([...sharedByPerson.keys()]);
    return people.filter((person) =>
      canStartDirectChat({
        initiator: party(user),
        recipient: party(person),
        sharedGroups: sharedByPerson.get(person._id.toHexString()) ?? [],
      }),
    );
  }

  private async existingChatsByPartner(userId: string): Promise<Map<string, string>> {
    const chats = await this.conversationModel
      .find({ type: 'direct', participantIds: userId }, { participantIds: 1 })
      .lean();
    return new Map(
      chats.flatMap((chat) => {
        const partner = chat.participantIds?.find((id) => !id.equals(userId));
        return partner ? [[partner.toHexString(), chat._id.toHexString()] as const] : [];
      }),
    );
  }

  private async ensureMemberships(
    conversationId: Types.ObjectId,
    userIds: Types.ObjectId[],
  ): Promise<void> {
    const operations: AnyBulkWriteOperation<Membership>[] = userIds.map((userId) => ({
      updateOne: {
        filter: { conversationId, userId },
        update: { $setOnInsert: { unreadCount: 0, lastReadMessageId: null, addedBy: null } },
        upsert: true,
      },
    }));
    await this.membershipModel.bulkWrite(operations);
  }
}

function refusalReason({ initiator, recipient }: DirectChatFacts): string {
  if (recipient.role === 'admin')
    return "Admins can't be messaged directly. Ask them in your group.";
  if (initiator.role === 'mentee' && recipient.role === 'mentee') {
    return 'Mentees can message each other only in groups where an admin has allowed it.';
  }
  return 'You can only message people from your program groups.';
}
