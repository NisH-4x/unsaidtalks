import { Camera, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/ui/Avatar';
import { GroupAvatar } from '../../components/ui/GroupAvatar';
import { useIsOnline, useTypists } from '../../store/presence.store';
import { ChatListItem } from '../../types/conversation';
import { cn } from '../../utils/cn';
import { describeTyping } from '../../utils/presenceText';
import { formatChatTime } from '../../utils/time';

function previewLine(chat: ChatListItem, currentUserId: string): { prefix?: string; text: string } {
  const last = chat.lastMessage;
  if (!last) return { text: 'No messages yet' };
  if (last.type === 'system') return { text: last.preview };
  if (last.senderId === currentUserId) return { prefix: 'You', text: last.preview };
  if (chat.type === 'group') return { prefix: last.senderName.split(' ')[0], text: last.preview };
  return { text: last.preview };
}

interface ChatListRowProps {
  chat: ChatListItem;
  currentUserId: string;
  selected: boolean;
}

export function ChatListRow({ chat, currentUserId, selected }: ChatListRowProps) {
  const isGroup = chat.type === 'group';
  const otherOnline = useIsOnline(chat.otherUser?.id);
  const typing = describeTyping(useTypists(chat.id), isGroup);
  const { prefix, text } = previewLine(chat, currentUserId);
  const unread = chat.unreadCount > 0;

  return (
    <Link
      to={`/chats/${chat.id}`}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors',
        selected ? 'bg-pine-50' : 'hover:bg-paper-sunk/70',
      )}
    >
      {isGroup ? (
        <GroupAvatar name={chat.title} size="lg" />
      ) : (
        <Avatar name={chat.title} seed={chat.otherUser?.id} size="lg" online={otherOnline} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('truncate text-[15px]', unread ? 'font-semibold' : 'font-medium')}>
            {chat.title}
            {otherOnline && <span className="sr-only">, online</span>}
          </p>
          <time
            dateTime={chat.lastActivityAt}
            className={cn(
              'shrink-0 text-xs',
              unread ? 'font-semibold text-pine-600' : 'text-ink-faint',
            )}
          >
            {formatChatTime(chat.lastMessage?.sentAt ?? chat.lastActivityAt)}
          </time>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          {typing ? (
            <p className="truncate text-sm font-medium italic text-pine-600">{typing}</p>
          ) : (
            <p
              className={cn(
                'truncate text-sm',
                unread ? 'text-ink-soft' : 'text-ink-muted',
                chat.lastMessage?.type === 'system' && 'italic',
              )}
            >
              {prefix && <span className="font-medium text-ink-soft">{prefix}: </span>}
              {chat.lastMessage?.type === 'image' && (
                <Camera className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-label="Photo:" />
              )}
              {chat.lastMessage?.type === 'file' && (
                <FileText className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-label="File:" />
              )}
              {text}
            </p>
          )}
          {unread && (
            <span
              className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-pine-600 px-1.5 text-[11px] font-semibold text-paper-raised"
              aria-label={`${chat.unreadCount} unread`}
            >
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
