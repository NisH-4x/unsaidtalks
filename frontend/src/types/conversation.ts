import { AdminUser, ContactUser } from './user';

export type ConversationType = 'group' | 'direct';
export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface LastMessage {
  messageId: string;
  senderId: string | null;
  senderName: string;
  type: MessageType;
  preview: string;
  sentAt: string;
}

export interface ChatListItem {
  id: string;
  type: ConversationType;
  title: string;
  program?: string;
  batch?: string;
  memberCount?: number;
  otherUser?: ContactUser;
  lastMessage: LastMessage | null;
  lastActivityAt: string;
  unreadCount: number;
}

export interface ConversationMember extends ContactUser {
  joinedAt: string;
  /** How far this member has read, for read receipts. */
  lastReadMessageId: string | null;
}

export interface ConversationDetails {
  id: string;
  type: ConversationType;
  title: string;
  description: string;
  program?: string;
  batch?: string;
  allowMenteeDirectChat: boolean;
  access: 'member' | 'moderator';
  members: ConversationMember[];
  lastReadMessageId: string | null;
  /** False for a private chat whose participants no longer share a program group. */
  canSend: boolean;
  createdAt: string;
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
  lastActivityAt: string;
  createdAt: string;
}

export interface AdminGroupMember extends AdminUser {
  joinedAt: string;
}

export interface AdminGroupDetails extends AdminGroupSummary {
  members: AdminGroupMember[];
}
