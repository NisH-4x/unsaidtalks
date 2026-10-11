import { ConversationType } from '../conversations/schemas/conversation.schema';
import { UserRole } from '../users/schemas/user.schema';

/**
 * How a user may see a conversation:
 * - `member`: they belong to it.
 * - `moderator`: an admin looking at a group they are not a member of.
 * - `none`: they cannot see it at all (the API answers 404, so its existence is not revealed).
 *
 * Private one-to-one chats are never visible to non-participants, admins included.
 */
export type ConversationAccess = 'member' | 'moderator' | 'none';

export interface ConversationAccessFacts {
  role: UserRole;
  isMember: boolean;
  conversationType: ConversationType;
}

export function conversationAccess({
  role,
  isMember,
  conversationType,
}: ConversationAccessFacts): ConversationAccess {
  if (isMember) return 'member';
  if (role === 'admin' && conversationType === 'group') return 'moderator';
  return 'none';
}

// Mentor tools exist only in program groups.
const guidesGroup = (role: UserRole, type: ConversationType) =>
  type === 'group' && (role === 'mentor' || role === 'admin');

/** Highlighted posts that every member is notified about. */
export function canPostAnnouncements(role: UserRole, type: ConversationType): boolean {
  return guidesGroup(role, type);
}

export function canPinMessages(role: UserRole, type: ConversationType): boolean {
  return guidesGroup(role, type);
}

/** Mentees flag their own questions as doubts; mentors and admins close them. */
export function canAskDoubts(role: UserRole, type: ConversationType): boolean {
  return type === 'group' && role === 'mentee';
}

export function canResolveDoubts(role: UserRole, type: ConversationType): boolean {
  return guidesGroup(role, type);
}

export interface MessageActionFacts {
  role: UserRole;
  conversationType: ConversationType;
  isSender: boolean;
}

/**
 * Everyone may delete their own messages. Mentors and admins may delete any message in a
 * program group; in private chats nobody can delete the other person's messages.
 */
export function canDeleteMessage({
  role,
  conversationType,
  isSender,
}: MessageActionFacts): boolean {
  return isSender || guidesGroup(role, conversationType);
}

/** Anyone but the sender may report a message. Admins act on messages instead of reporting them. */
export function canReportMessage({ role, isSender }: MessageActionFacts): boolean {
  return !isSender && role !== 'admin';
}

/** Only active mentors and mentees can be placed in program groups. */
export function canJoinGroups(user: { role: UserRole; status: string }): boolean {
  return user.status === 'active' && (user.role === 'mentor' || user.role === 'mentee');
}

export interface DirectChatParty {
  id: string;
  role: UserRole;
  status: string;
}

export interface DirectChatFacts {
  initiator: DirectChatParty;
  recipient: DirectChatParty;
  /** The program groups both people belong to. */
  sharedGroups: Array<{ allowMenteeDirectChat: boolean }>;
}

/**
 * The relationship that allows two non-admins to talk privately: they share a program
 * group, and if both are mentees, at least one shared group allows mentee-to-mentee chats.
 * It is symmetric, so a mentor may message any mentee who may message them.
 */
function shareMentorshipGroup({ initiator, recipient, sharedGroups }: DirectChatFacts): boolean {
  if (sharedGroups.length === 0) return false;
  const bothMentees = initiator.role === 'mentee' && recipient.role === 'mentee';
  return !bothMentees || sharedGroups.some((group) => group.allowMenteeDirectChat);
}

function bothActiveAndDifferent({ initiator, recipient }: DirectChatFacts): boolean {
  return (
    initiator.id !== recipient.id && initiator.status === 'active' && recipient.status === 'active'
  );
}

/** Whether `initiator` may open a new private chat with `recipient`. */
export function canStartDirectChat(facts: DirectChatFacts): boolean {
  if (!bothActiveAndDifferent(facts)) return false;
  if (facts.initiator.role === 'admin') return true;
  if (facts.recipient.role === 'admin') return false;
  return shareMentorshipGroup(facts);
}

/**
 * Whether a participant may still send in an existing private chat. Chats an admin is part
 * of stay open; others become read-only once the two people no longer share a group.
 */
export function canMessageDirectly(facts: DirectChatFacts): boolean {
  if (!bothActiveAndDifferent(facts)) return false;
  if (facts.initiator.role === 'admin' || facts.recipient.role === 'admin') return true;
  return shareMentorshipGroup(facts);
}
