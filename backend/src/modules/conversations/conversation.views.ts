import { Types } from 'mongoose';
import { ConversationAccess } from '../access/access-policy';
import { MessageType } from '../messages/schemas/message.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { AdminUserView, ContactView, toAdminUserView, toContactView } from '../users/user.views';
import { Conversation, ConversationType, LastMessage } from './schemas/conversation.schema';
import { Membership } from './schemas/membership.schema';

type StoredConversation = Conversation & { _id: Types.ObjectId };
type StoredUser = User & { _id: Types.ObjectId };

export interface LastMessageView {
  messageId: string;
  senderId: string | null;
  senderName: string;
  type: MessageType;
  preview: string;
  sentAt: Date;
}

export interface ChatListItem {
  id: string;
  type: ConversationType;
  title: string;
  program?: string;
  batch?: string;
  memberCount?: number;
  otherUser?: ContactView;
  lastMessage: LastMessageView | null;
  lastActivityAt: Date;
  unreadCount: number;
}

export interface ConversationMemberView extends ContactView {
  joinedAt: Date;
  /** How far this member has read, shown to the others as read receipts. */
  lastReadMessageId: string | null;
}

export interface ConversationDetailsView {
  id: string;
  type: ConversationType;
  title: string;
  description: string;
  program?: string;
  batch?: string;
  allowMenteeDirectChat: boolean;
  access: Exclude<ConversationAccess, 'none'>;
  members: ConversationMemberView[];
  /** Where the viewer stopped reading, used to place the "new messages" divider. */
  lastReadMessageId: string | null;
  /** False for a private chat whose participants no longer share a program group. */
  canSend: boolean;
  createdAt: Date;
}

export interface AdminGroupSummary {
  id: string;
  name: string;
  description: string;
  program?: string;
  batch?: string;
  allowMenteeDirectChat: boolean;
  memberCount: number;
  mentorCount: number;
  menteeCount: number;
  lastActivityAt: Date;
  createdAt: Date;
}

export interface AdminGroupMemberView extends AdminUserView {
  joinedAt: Date;
}

export interface AdminGroupDetails extends AdminGroupSummary {
  members: AdminGroupMemberView[];
}

export interface RoleCounts {
  mentors: number;
  mentees: number;
  total: number;
}

const ROLE_ORDER: Record<UserRole, number> = { admin: 0, mentor: 1, mentee: 2 };

/** Mentors first, then mentees, alphabetical within each role. */
export function byRoleThenName(a: { role: UserRole; name: string }, b: typeof a): number {
  return ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name);
}

export function toLastMessageView(lastMessage: LastMessage | null): LastMessageView | null {
  if (!lastMessage) return null;
  return {
    messageId: lastMessage.messageId.toHexString(),
    senderId: lastMessage.senderId?.toHexString() ?? null,
    senderName: lastMessage.senderName,
    type: lastMessage.type,
    preview: lastMessage.preview,
    sentAt: lastMessage.sentAt,
  };
}

export function toChatListItem(
  conversation: StoredConversation,
  unreadCount: number,
  extras: { memberCount?: number; otherUser?: ContactView },
): ChatListItem {
  const isGroup = conversation.type === 'group';
  return {
    id: conversation._id.toHexString(),
    type: conversation.type,
    title: isGroup ? (conversation.name ?? '') : (extras.otherUser?.name ?? 'Unknown user'),
    ...(isGroup && {
      program: conversation.program,
      batch: conversation.batch,
      memberCount: extras.memberCount ?? 0,
    }),
    ...(!isGroup && extras.otherUser && { otherUser: extras.otherUser }),
    lastMessage: toLastMessageView(conversation.lastMessage),
    lastActivityAt: conversation.lastActivityAt,
    unreadCount,
  };
}

export function toConversationDetails(
  conversation: StoredConversation,
  access: Exclude<ConversationAccess, 'none'>,
  members: Array<{ user: StoredUser; joinedAt: Date; lastReadMessageId: Types.ObjectId | null }>,
  viewerId: string,
  viewerMembership: Pick<Membership, 'lastReadMessageId'> | null,
  canSend: boolean,
): ConversationDetailsView {
  const memberViews = members
    .map(({ user, joinedAt, lastReadMessageId }) => ({
      ...toContactView(user),
      joinedAt,
      lastReadMessageId: lastReadMessageId?.toHexString() ?? null,
    }))
    .sort(byRoleThenName);
  const otherUser = memberViews.find((member) => member.id !== viewerId);

  return {
    id: conversation._id.toHexString(),
    type: conversation.type,
    title:
      conversation.type === 'group' ? (conversation.name ?? '') : (otherUser?.name ?? 'Unknown'),
    description: conversation.description,
    program: conversation.program,
    batch: conversation.batch,
    allowMenteeDirectChat: conversation.allowMenteeDirectChat,
    access,
    members: memberViews,
    lastReadMessageId: viewerMembership?.lastReadMessageId?.toHexString() ?? null,
    canSend,
    createdAt: conversation.createdAt,
  };
}

export function toAdminGroupSummary(
  group: StoredConversation,
  counts: RoleCounts,
): AdminGroupSummary {
  return {
    id: group._id.toHexString(),
    name: group.name ?? '',
    description: group.description,
    program: group.program,
    batch: group.batch,
    allowMenteeDirectChat: group.allowMenteeDirectChat,
    memberCount: counts.total,
    mentorCount: counts.mentors,
    menteeCount: counts.mentees,
    lastActivityAt: group.lastActivityAt,
    createdAt: group.createdAt,
  };
}

export function toAdminGroupDetails(
  group: StoredConversation,
  members: Array<{ user: StoredUser; joinedAt: Date }>,
): AdminGroupDetails {
  const memberViews = members
    .map(({ user, joinedAt }) => ({ ...toAdminUserView(user), joinedAt }))
    .sort(byRoleThenName);
  const counts: RoleCounts = {
    mentors: memberViews.filter((member) => member.role === 'mentor').length,
    mentees: memberViews.filter((member) => member.role === 'mentee').length,
    total: memberViews.length,
  };
  return { ...toAdminGroupSummary(group, counts), members: memberViews };
}
