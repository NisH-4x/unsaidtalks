import { AppNotification } from '../types/notification';

/** One line saying what happened, e.g. "Priya Sharma replied to your message in TCS NQT Prep". */
export function describeNotification({ type, actor, conversation }: AppNotification): string {
  const who = actor?.name ?? 'Someone';
  const where = conversation.name ? ` in ${conversation.name}` : '';
  switch (type) {
    case 'reply':
      return `${who} replied to your message${where}`;
    case 'announcement':
      return `${who} posted an announcement${where}`;
    case 'doubt_resolved':
      return `${who} resolved your doubt${where}`;
  }
}

/** Opens the conversation and scrolls to the message the notification is about. */
export function notificationLink({ conversation, messageId }: AppNotification): string {
  return `/chats/${conversation.id}?message=${messageId}`;
}
