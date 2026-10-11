import { ConversationType } from '../types/conversation';
import { ChatMessage } from '../types/message';
import { UserRole } from '../types/user';

// Mirrors backend/src/modules/access/access-policy.ts so the UI only offers actions the
// server will accept. The server still checks every action itself.

const guidesGroup = (role: UserRole, type: ConversationType) =>
  type === 'group' && (role === 'mentor' || role === 'admin');

export const canPostAnnouncements = guidesGroup;
export const canPinMessages = guidesGroup;
export const canResolveDoubts = guidesGroup;

export function canAskDoubts(role: UserRole, type: ConversationType): boolean {
  return type === 'group' && role === 'mentee';
}

export function canDeleteMessage(role: UserRole, type: ConversationType, isOwn: boolean): boolean {
  return isOwn || guidesGroup(role, type);
}

export const EDIT_WINDOW_MS = 5 * 60 * 1000;

/** The sender may edit a stored message for five minutes after sending it. */
export function canEditMessage(message: ChatMessage, isOwn: boolean, now = Date.now()): boolean {
  return (
    isOwn &&
    !message.delivery &&
    !message.isDeleted &&
    message.type !== 'system' &&
    now - Date.parse(message.createdAt) < EDIT_WINDOW_MS
  );
}

export function canReportMessage(role: UserRole, isOwn: boolean): boolean {
  return !isOwn && role !== 'admin';
}
