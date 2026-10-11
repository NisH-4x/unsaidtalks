import { MessageView } from './message.views';

export const MessageEvent = {
  Created: 'message.created',
  Updated: 'message.updated',
} as const;

export interface MessageCreatedEvent {
  message: MessageView;
  /** Short text for chat lists, so clients do not need their own preview rules. */
  preview: string;
  /** The sender's temporary id for the message, so their own screens can swap the draft for it. */
  clientId?: string;
}

export type MessageChange =
  | 'pinned'
  | 'unpinned'
  | 'doubt-marked'
  | 'doubt-removed'
  | 'doubt-resolved'
  | 'doubt-reopened'
  | 'edited'
  | 'reactions'
  | 'deleted';

/** A message was pinned or unpinned, its doubt status changed, or it was edited or deleted. */
export interface MessageUpdatedEvent {
  message: MessageView;
  change: MessageChange;
  actorId: string;
}
