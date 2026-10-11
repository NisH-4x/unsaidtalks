import { Message } from '../types/message';

export interface ReadState {
  /** Members other than the sender who have read the message. */
  readerIds: string[];
  /** Members other than the sender. */
  audienceIds: string[];
}

/** Who has read a message, from each member's read position (message ids grow over time). */
export function readStateOf(
  message: Pick<Message, 'id' | 'sender'>,
  memberIds: string[],
  positions: Record<string, string | null> | undefined,
): ReadState {
  const audienceIds = memberIds.filter((id) => id !== message.sender?.id);
  const readerIds = audienceIds.filter((id) => {
    const position = positions?.[id];
    return Boolean(position && position >= message.id);
  });
  return { readerIds, audienceIds };
}

export const isReadByEveryone = ({ readerIds, audienceIds }: ReadState) =>
  audienceIds.length > 0 && readerIds.length === audienceIds.length;
