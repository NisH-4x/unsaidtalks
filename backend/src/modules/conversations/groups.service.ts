import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model, Types } from 'mongoose';
import { canJoinGroups } from '../access/access-policy';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import {
  GroupCreatedEvent,
  GroupEvent,
  GroupMemberRemovedEvent,
  GroupMembersAddedEvent,
  PersonRef,
} from './conversation.events';
import {
  AdminGroupDetails,
  AdminGroupSummary,
  RoleCounts,
  toAdminGroupDetails,
  toAdminGroupSummary,
} from './conversation.views';
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto';
import { Conversation } from './schemas/conversation.schema';
import { Membership } from './schemas/membership.schema';

const NO_MEMBERS: RoleCounts = { mentors: 0, mentees: 0, total: 0 };

/** Admin-only management of program groups and who belongs to them. */
@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  async list(): Promise<AdminGroupSummary[]> {
    const groups = await this.conversationModel
      .find({ type: 'group' })
      .sort({ lastActivityAt: -1 })
      .lean();
    const counts = await this.roleCounts(groups.map((group) => group._id));
    return groups.map((group) =>
      toAdminGroupSummary(group, counts.get(group._id.toHexString()) ?? NO_MEMBERS),
    );
  }

  async get(groupId: Types.ObjectId): Promise<AdminGroupDetails> {
    const group = await this.findGroup(groupId);
    const memberships = await this.membershipModel.find({ conversationId: groupId }).lean();
    const usersById = new Map(
      (await this.users.findByIds(memberships.map((m) => m.userId))).map((u) => [
        u._id.toHexString(),
        u,
      ]),
    );
    const members = memberships.flatMap((membership) => {
      const user = usersById.get(membership.userId.toHexString());
      return user ? [{ user, joinedAt: membership.createdAt }] : [];
    });
    return toAdminGroupDetails(group, members);
  }

  async create(actor: PersonRef, { memberIds = [], ...details }: CreateGroupDto) {
    const members = await this.eligibleUsers(memberIds);
    const group = await this.conversationModel.create({
      ...details,
      type: 'group',
      createdBy: actor.id,
    });

    await this.events.emitAsync(GroupEvent.Created, {
      conversationId: group._id.toHexString(),
      actor,
    } satisfies GroupCreatedEvent);
    await this.insertMemberships(group._id, members, actor);

    return this.get(group._id);
  }

  async update(groupId: Types.ObjectId, changes: UpdateGroupDto): Promise<AdminGroupDetails> {
    const updated = await this.conversationModel
      .findOneAndUpdate({ _id: groupId, type: 'group' }, changes, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Group not found');
    return this.get(groupId);
  }

  async addMembers(
    actor: PersonRef,
    groupId: Types.ObjectId,
    userIds: string[],
  ): Promise<AdminGroupDetails> {
    await this.findGroup(groupId);
    await this.insertMemberships(groupId, await this.eligibleUsers(userIds), actor);
    return this.get(groupId);
  }

  async removeMember(
    actor: PersonRef,
    groupId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<AdminGroupDetails> {
    await this.findGroup(groupId);
    const removed = await this.membershipModel
      .findOneAndDelete({ conversationId: groupId, userId })
      .exec();
    if (!removed) throw new NotFoundException('This person is not a member of the group');

    const user = await this.users.findById(userId);
    await this.events.emitAsync(GroupEvent.MemberRemoved, {
      conversationId: groupId.toHexString(),
      actor,
      member: { id: userId.toHexString(), name: user?.name ?? 'a member' },
    } satisfies GroupMemberRemovedEvent);

    return this.get(groupId);
  }

  private async findGroup(groupId: Types.ObjectId) {
    const group = await this.conversationModel.findOne({ _id: groupId, type: 'group' }).lean();
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  private async eligibleUsers(userIds: string[]): Promise<UserDocument[]> {
    const uniqueIds = [...new Set(userIds)];
    const users = await this.users.findByIds(uniqueIds);
    if (users.length !== uniqueIds.length || !users.every(canJoinGroups)) {
      throw new BadRequestException('Only active mentors and mentees can be added to a group');
    }
    return users;
  }

  /**
   * Upserts make this safe to repeat or run concurrently: people who are already members
   * are left untouched, and only the newly inserted ones are announced. New members start
   * with nothing unread but can scroll back through the full history.
   */
  private async insertMemberships(
    groupId: Types.ObjectId,
    users: UserDocument[],
    actor: PersonRef,
  ): Promise<void> {
    if (users.length === 0) return;

    const group = await this.findGroup(groupId);
    const lastReadMessageId = group.lastMessage?.messageId ?? null;
    const operations: AnyBulkWriteOperation<Membership>[] = users.map((user) => ({
      updateOne: {
        filter: { conversationId: groupId, userId: user._id },
        update: {
          $setOnInsert: {
            unreadCount: 0,
            lastReadMessageId,
            addedBy: new Types.ObjectId(actor.id),
          },
        },
        upsert: true,
      },
    }));
    const result = await this.membershipModel.bulkWrite(operations);

    const insertedIndexes = Object.keys(result.upsertedIds).map(Number);
    const added = insertedIndexes.map((index) => users[index]);
    if (added.length === 0) return;

    await this.events.emitAsync(GroupEvent.MembersAdded, {
      conversationId: groupId.toHexString(),
      actor,
      members: added.map((user) => ({ id: user._id.toHexString(), name: user.name })),
    } satisfies GroupMembersAddedEvent);
  }

  private async roleCounts(groupIds: Types.ObjectId[]): Promise<Map<string, RoleCounts>> {
    if (groupIds.length === 0) return new Map();

    const rows = await this.membershipModel.aggregate<{
      _id: { conversationId: Types.ObjectId; role: string };
      count: number;
    }>([
      { $match: { conversationId: { $in: groupIds } } },
      {
        $lookup: {
          from: this.userModel.collection.collectionName,
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { role: 1 } }],
        },
      },
      { $unwind: '$user' },
      {
        $group: {
          _id: { conversationId: '$conversationId', role: '$user.role' },
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = new Map<string, RoleCounts>();
    for (const { _id, count } of rows) {
      const key = _id.conversationId.toHexString();
      const entry = counts.get(key) ?? { ...NO_MEMBERS };
      if (_id.role === 'mentor') entry.mentors += count;
      if (_id.role === 'mentee') entry.mentees += count;
      entry.total += count;
      counts.set(key, entry);
    }
    return counts;
  }
}
