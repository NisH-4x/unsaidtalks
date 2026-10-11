import {
  Ban,
  Camera,
  Check,
  CheckCheck,
  Clock3,
  FileText,
  Megaphone,
  Pin,
  RotateCw,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { LinkifiedText } from '../../../components/LinkifiedText';
import { Avatar } from '../../../components/ui/Avatar';
import { RoleBadge } from '../../../components/ui/RoleBadge';
import { useLongPress } from '../../../hooks/useLongPress';
import { Attachment, ChatMessage, Message } from '../../../types/message';
import { messageSummary } from '../../../utils/attachments';
import { cn } from '../../../utils/cn';
import { isReadByEveryone, ReadState } from '../../../utils/receipts';
import { formatMessageTime } from '../../../utils/time';
import { AttachmentFile } from './attachments/AttachmentFile';
import { AttachmentImage } from './attachments/AttachmentImage';
import { ImageViewer } from './attachments/ImageViewer';
import { DoubtChip } from './DoubtChip';
import { toggleReaction } from './messageActions';
import { MessageMenu, MessageMenuHandle } from './MessageMenu';
import { MessageMenuContext, menuItemsFor } from './messageMenuItems';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  /** First message of a run from the same person: shows their name, badge and avatar. */
  startsRun: boolean;
  showSenderDetails: boolean;
  highlighted: boolean;
  menu: MessageMenuContext;
  /** Who has read the viewer's own message; absent for other people's messages. */
  readState?: ReadState;
  nameOf: (userId: string) => string | undefined;
  onJump: (messageId: string) => void;
  onRetry: () => void;
  onDiscard: () => void;
}

function DeliveryIcon({ message, readState }: { message: ChatMessage; readState?: ReadState }) {
  if (message.delivery === 'sending') {
    return <Clock3 className="h-3.5 w-3.5" aria-label="Sending" />;
  }
  if (message.delivery === 'failed') return null;
  if (readState && isReadByEveryone(readState)) {
    return (
      <CheckCheck
        className="h-3.5 w-3.5 text-pine-600"
        aria-label={readState.audienceIds.length > 1 ? 'Read by everyone' : 'Read'}
      />
    );
  }
  return <Check className="h-3.5 w-3.5" aria-label="Sent" />;
}

interface ReactionChipsProps {
  reactions: ChatMessage['reactions'];
  viewerId: string;
  canReact: boolean;
  nameOf: (userId: string) => string | undefined;
  onToggle: (emoji: string, mine: boolean) => void;
  alignEnd: boolean;
}

function ReactionChips({
  reactions,
  viewerId,
  canReact,
  nameOf,
  onToggle,
  alignEnd,
}: ReactionChipsProps) {
  if (reactions.length === 0) return null;
  return (
    <div className={cn('mt-1 flex flex-wrap gap-1', alignEnd && 'justify-end')}>
      {reactions.map(({ emoji, userIds }) => {
        const mine = userIds.includes(viewerId);
        const names = userIds.map((id) =>
          id === viewerId ? 'You' : (nameOf(id) ?? 'A former member'),
        );
        return (
          <button
            key={emoji}
            type="button"
            disabled={!canReact}
            onClick={() => onToggle(emoji, mine)}
            aria-pressed={mine}
            aria-label={`${emoji} ${userIds.length}: ${names.join(', ')}`}
            title={names.join(', ')}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold shadow-bubble transition-colors disabled:cursor-default',
              mine
                ? 'border-pine-300 bg-pine-50 text-pine-800'
                : 'border-line bg-paper-raised text-ink-soft enabled:hover:bg-paper-sunk',
            )}
          >
            <span aria-hidden="true">{emoji}</span>
            {userIds.length}
          </button>
        );
      })}
    </div>
  );
}

function ReplyQuote({
  replyTo,
  onJump,
}: {
  replyTo: NonNullable<Message['replyTo']>;
  onJump: (messageId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onJump(replyTo.messageId)}
      title="Go to the original message"
      className="mb-1.5 block w-full rounded-lg border-l-[3px] border-pine-400 bg-ink/[0.04] px-2.5 py-1.5 text-left transition-colors hover:bg-ink/[0.08]"
    >
      <span className="block truncate text-xs font-semibold text-pine-700">
        {replyTo.senderName || 'Unknown sender'}
      </span>
      <span className="line-clamp-2 text-[13px] leading-snug text-ink-muted">
        {replyTo.isDeleted ? (
          <i>This message was deleted</i>
        ) : (
          <>
            {replyTo.type === 'image' && (
              <Camera className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-label="Photo:" />
            )}
            {replyTo.type === 'file' && (
              <FileText className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-label="File:" />
            )}
            {replyTo.preview}
          </>
        )}
      </span>
    </button>
  );
}

function AttachmentView({
  message,
  onOpenImage,
}: {
  message: ChatMessage & { attachment: Attachment };
  onOpenImage: (url: string) => void;
}) {
  return (
    <div className={cn('-mx-1.5 mt-0.5', message.text && 'mb-1.5')}>
      {message.type === 'image' ? (
        <AttachmentImage message={message} onOpen={onOpenImage} />
      ) : (
        <AttachmentFile message={message} />
      )}
    </div>
  );
}

export function MessageBubble({
  message,
  isOwn,
  startsRun,
  showSenderDetails,
  highlighted,
  menu,
  readState,
  nameOf,
  onJump,
  onRetry,
  onDiscard,
}: MessageBubbleProps) {
  const { sender, replyTo, doubt, pin, isDeleted, attachment, importedFrom } = message;
  const senderName = sender?.name ?? importedFrom?.senderName;
  // A deleted announcement keeps its place but no longer stands out.
  const isAnnouncement = message.isAnnouncement && !isDeleted;
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const showName = showSenderDetails && (startsRun || isAnnouncement) && !isOwn && senderName;
  const shownAttachment = !isDeleted && attachment ? { ...message, attachment } : null;
  const canReact = menu.canReply && !message.delivery && !isDeleted && message.type !== 'system';
  const resolverName = doubt?.resolvedBy ? nameOf(doubt.resolvedBy) : undefined;
  const menuRef = useRef<MessageMenuHandle>(null);
  const longPress = useLongPress(() => menuRef.current?.open());
  const menuItems = menuItemsFor(message, isOwn, menu);
  const reactionChoices = canReact
    ? {
        mine: message.reactions
          .filter((r) => r.userIds.includes(menu.viewerId))
          .map((r) => r.emoji),
        onToggle: (emoji: string) =>
          void toggleReaction(
            message,
            emoji,
            message.reactions.some((r) => r.emoji === emoji && r.userIds.includes(menu.viewerId)),
          ),
      }
    : undefined;
  const hasMenu = menuItems.length > 0 || reactionChoices !== undefined;
  const ringClass = highlighted
    ? 'ring-2 ring-marigold-400 ring-offset-2 ring-offset-paper'
    : message.delivery === 'failed'
      ? 'ring-1 ring-clay-200'
      : isAnnouncement && 'ring-1 ring-marigold-200';

  return (
    <div
      className={cn(
        'group flex gap-2',
        isOwn ? 'justify-end' : 'justify-start',
        startsRun || isAnnouncement ? 'mt-3' : 'mt-1',
      )}
      data-message-id={message.id}
    >
      {showSenderDetails && !isOwn && (
        <div className="w-8 shrink-0">
          {(startsRun || isAnnouncement) && senderName && (
            <Avatar name={senderName} seed={sender?.id ?? senderName} size="sm" />
          )}
        </div>
      )}

      <div
        className={cn(
          'flex min-w-0 items-start gap-1',
          isAnnouncement ? 'max-w-[92%] lg:max-w-[78%]' : 'max-w-[85%] lg:max-w-[70%]',
          isOwn && 'flex-row-reverse',
        )}
      >
        <div className={cn('flex min-w-0 flex-col', isOwn && 'items-end')}>
          <div
            {...(hasMenu ? longPress : {})}
            className={cn(
              'min-w-0 max-w-full rounded-2xl px-3.5 py-2 text-ink shadow-bubble transition-shadow duration-500',
              // A hold opens the actions on touch screens instead of selecting text.
              hasMenu &&
                '[@media(pointer:coarse)]:select-none [@media(pointer:coarse)]:[-webkit-touch-callout:none]',
              isAnnouncement ? 'bg-marigold-50' : isOwn ? 'bg-pine-100' : 'bg-paper-raised',
              startsRun && !isAnnouncement && (isOwn ? 'rounded-tr-md' : 'rounded-tl-md'),
              // An image sets the bubble's width; its caption wraps beneath it.
              shownAttachment?.type === 'image' && 'w-min',
              ringClass,
            )}
          >
            {isAnnouncement && (
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-marigold-700">
                <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                Announcement
              </p>
            )}

            {showName && (
              <p className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[13px] font-semibold text-ink-soft">{senderName}</span>
                {sender ? (
                  <RoleBadge role={sender.role} />
                ) : (
                  <span className="rounded-md bg-paper-sunk px-1.5 py-0.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-muted">
                    WhatsApp
                  </span>
                )}
              </p>
            )}

            {replyTo && !isDeleted && <ReplyQuote replyTo={replyTo} onJump={onJump} />}

            {shownAttachment && (
              <AttachmentView message={shownAttachment} onOpenImage={setViewerUrl} />
            )}

            {isDeleted ? (
              <p className="flex items-center gap-1.5 text-[15px] italic text-ink-faint">
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                {message.removedByModerator
                  ? 'This message was removed by a mentor or admin'
                  : 'This message was deleted'}
              </p>
            ) : (
              message.text && (
                <p className="whitespace-pre-wrap text-[15px] leading-snug [overflow-wrap:anywhere]">
                  <LinkifiedText text={message.text} />
                </p>
              )
            )}

            <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              {doubt && !isDeleted && (
                <span className="mr-auto">
                  <DoubtChip doubt={doubt} resolverName={resolverName} />
                </span>
              )}
              <p
                className={cn(
                  'flex items-center gap-1 text-[11px]',
                  isOwn && !isAnnouncement ? 'text-pine-700/80' : 'text-ink-faint',
                )}
              >
                {pin && !isDeleted && <Pin className="h-3 w-3" aria-label="Pinned" />}
                {message.editedAt && <span>edited</span>}
                {importedFrom && <span title="Imported from a WhatsApp chat">imported</span>}
                <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                {isOwn && <DeliveryIcon message={message} readState={readState} />}
              </p>
            </div>
          </div>

          {!isDeleted && (
            <ReactionChips
              reactions={message.reactions}
              viewerId={menu.viewerId}
              canReact={canReact}
              nameOf={nameOf}
              onToggle={(emoji, mine) => void toggleReaction(message, emoji, mine)}
              alignEnd={isOwn}
            />
          )}

          {message.delivery === 'failed' && (
            <p className="mt-1 flex flex-wrap items-center justify-end gap-x-3 text-xs text-clay-600">
              <span>{message.failureReason ?? 'Not sent.'}</span>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 font-semibold hover:underline"
              >
                <RotateCw className="h-3 w-3" aria-hidden="true" />
                Retry
              </button>
              <button type="button" onClick={onDiscard} className="font-semibold hover:underline">
                Discard
              </button>
            </p>
          )}
        </div>

        <MessageMenu
          ref={menuRef}
          items={menuItems}
          align={isOwn ? 'start' : 'end'}
          reactions={reactionChoices}
          context={{
            name: isOwn ? 'You' : (senderName ?? 'Message'),
            text: isDeleted ? 'This message was deleted' : messageSummary(message),
          }}
        />
      </div>

      {viewerUrl && (
        <ImageViewer message={message} url={viewerUrl} onClose={() => setViewerUrl(null)} />
      )}
    </div>
  );
}
