import { ArrowDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadError } from '../../../components/ui/LoadError';
import { Spinner } from '../../../components/ui/Spinner';
import { useMessagesStore } from '../../../store/messages.store';
import { useReceiptsStore } from '../../../store/receipts.store';
import { ChatMessage } from '../../../types/message';
import { scrollBehavior } from '../../../utils/motion';
import { readStateOf } from '../../../utils/receipts';
import { formatDayLabel, isSameDay } from '../../../utils/time';
import { jumpToMessage } from './messageActions';
import { MessageBubble } from './MessageBubble';
import { MessageMenuContext } from './messageMenuItems';

const NEAR_BOTTOM_PX = 120;
const RUN_GAP_MS = 5 * 60 * 1000;
const HIGHLIGHT_MS = 2000;
const NO_MESSAGES: ChatMessage[] = [];

interface MessageListProps {
  conversationId: string;
  currentUserId: string;
  isGroup: boolean;
  /** Read position when the conversation was opened; later messages from others are "new". */
  lastReadMessageId: string | null;
  menu: MessageMenuContext;
  nameOf: (userId: string) => string | undefined;
  memberIds: string[];
}

function DayDivider({ date }: { date: string }) {
  return (
    <div className="sticky top-2 z-10 my-4 flex justify-center">
      <span className="rounded-full bg-paper-raised/95 px-3 py-1 text-xs font-medium text-ink-muted shadow-bubble">
        {formatDayLabel(date)}
      </span>
    </div>
  );
}

function SystemNote({ text }: { text: string }) {
  return (
    <p className="mx-auto my-3 max-w-sm rounded-full bg-paper-sunk px-3 py-1 text-center text-xs text-ink-muted">
      {text}
    </p>
  );
}

function isFromSomeoneElse(message: ChatMessage, currentUserId: string): boolean {
  return message.type !== 'system' && !message.delivery && message.sender?.id !== currentUserId;
}

// Imported messages may have no account behind them, so their WhatsApp name tells senders apart.
const senderKey = (message: ChatMessage) => message.sender?.id ?? message.importedFrom?.senderName;

function startsRun(message: ChatMessage, previous: ChatMessage | undefined): boolean {
  if (!previous || previous.type === 'system' || message.type === 'system') return true;
  if (!isSameDay(previous.createdAt, message.createdAt)) return true;
  const gap = new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime();
  return senderKey(previous) !== senderKey(message) || gap > RUN_GAP_MS;
}

export function MessageList({
  conversationId,
  currentUserId,
  isGroup,
  lastReadMessageId,
  menu,
  nameOf,
  memberIds,
}: MessageListProps) {
  const thread = useMessagesStore((state) => state.threads[conversationId]);
  const open = useMessagesStore((state) => state.open);
  const loadOlder = useMessagesStore((state) => state.loadOlder);
  const retry = useMessagesStore((state) => state.retry);
  const discard = useMessagesStore((state) => state.discard);
  const jumpTarget = useMessagesStore((state) => state.jumpTarget);
  const readPositions = useReceiptsStore((state) => state.positions[conversationId]);
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedMessageId = searchParams.get('message');

  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const firstIdRef = useRef<string>();
  const lastIdRef = useRef<string>();
  const prependSnapshotRef = useRef<{ height: number; top: number } | null>(null);
  const initialScrollDoneRef = useRef(false);
  const [seenUpToId, setSeenUpToId] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const messages = thread?.messages ?? NO_MESSAGES;
  const ready = thread?.status === 'ready';
  const firstUnreadId = lastReadMessageId
    ? messages.find((m) => m.id > lastReadMessageId && isFromSomeoneElse(m, currentUserId))?.id
    : undefined;
  const unseenCount = seenUpToId
    ? messages.filter((m) => m.id > seenUpToId && isFromSomeoneElse(m, currentUserId)).length
    : 0;

  // Keeps the view anchored: open at the first unread message (or the bottom), hold the
  // reading position when older messages are added above, and follow new messages only
  // when the reader is already at the bottom or sent the message themselves.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !ready) return;
    const firstId = messages[0]?.id;
    const newest = messages.at(-1);

    if (!initialScrollDoneRef.current) {
      const divider = container.querySelector('[data-unread-divider]');
      if (divider) divider.scrollIntoView({ block: 'center' });
      else container.scrollTop = container.scrollHeight;
      initialScrollDoneRef.current = true;
    } else if (firstId !== firstIdRef.current && prependSnapshotRef.current) {
      const { height, top } = prependSnapshotRef.current;
      container.scrollTop = container.scrollHeight - height + top;
      prependSnapshotRef.current = null;
    } else if (newest && newest.id !== lastIdRef.current) {
      const sentByMe = newest.sender?.id === currentUserId;
      if (sentByMe || nearBottomRef.current) {
        container.scrollTo({ top: container.scrollHeight, behavior: scrollBehavior() });
      }
    }

    firstIdRef.current = firstId;
    lastIdRef.current = newest?.id;
  }, [messages, ready, currentUserId]);

  // A link such as a notification's (`?message=<id>`) opens the chat at that message.
  useEffect(() => {
    if (!ready || !linkedMessageId) return;
    void jumpToMessage(conversationId, linkedMessageId);
    setSearchParams({}, { replace: true });
  }, [ready, linkedMessageId, conversationId, setSearchParams]);

  // The store has already loaded history back to the target, so it is in the DOM here.
  useLayoutEffect(() => {
    if (!ready || jumpTarget?.conversationId !== conversationId) return;
    const target = containerRef.current?.querySelector(
      `[data-message-id="${jumpTarget.messageId}"]`,
    );
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    setHighlightedId(jumpTarget.messageId);
    const timer = window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [jumpTarget, ready, conversationId]);

  // Loads the previous page when the reader scrolls to the top.
  useEffect(() => {
    const container = containerRef.current;
    const sentinel = topSentinelRef.current;
    if (!container || !sentinel || !ready || !thread?.hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !initialScrollDoneRef.current) return;
        prependSnapshotRef.current = {
          height: container.scrollHeight,
          top: container.scrollTop,
        };
        void loadOlder(conversationId);
      },
      { root: container, rootMargin: '200px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [conversationId, ready, thread?.hasMore, thread?.loadingOlder, loadOlder]);

  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    nearBottomRef.current = distance < NEAR_BOTTOM_PX;
    setShowJump(!nearBottomRef.current);

    const newestStored = messages.filter((m) => !m.delivery).at(-1)?.id ?? null;
    if (nearBottomRef.current && newestStored) {
      setSeenUpToId((current) => (current === newestStored ? current : newestStored));
    }
  }

  function jumpToLatest() {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: scrollBehavior(),
    });
  }

  if (!thread || thread.status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center text-pine-600">
        <Spinner />
      </div>
    );
  }
  if (thread.status === 'error') {
    return (
      <div className="flex-1 p-4">
        <LoadError
          message={thread.error ?? 'Could not load messages.'}
          onRetry={() => void open(conversationId)}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="grain h-full overflow-y-auto bg-paper-sunk/40 px-3 pb-4 sm:px-6"
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        <div ref={topSentinelRef} />
        {thread.loadingOlder && (
          <div className="flex justify-center py-3 text-pine-600">
            <Spinner className="h-4 w-4" />
          </div>
        )}
        {!thread.hasMore && messages.length > 0 && (
          <p className="py-4 text-center text-xs text-ink-faint">
            This is the start of the conversation.
          </p>
        )}
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-ink-muted">No messages yet. Say hello!</p>
        )}

        <div className="mx-auto max-w-3xl">
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const newDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
            const isFirstUnread = message.id === firstUnreadId;

            return (
              <div key={message.clientId ?? message.id}>
                {newDay && <DayDivider date={message.createdAt} />}
                {isFirstUnread && (
                  <div data-unread-divider className="my-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-marigold-300" />
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-marigold-700">
                      New messages
                    </span>
                    <span className="h-px flex-1 bg-marigold-300" />
                  </div>
                )}
                {message.type === 'system' ? (
                  <SystemNote text={message.text} />
                ) : (
                  <MessageBubble
                    message={message}
                    isOwn={message.sender?.id === currentUserId}
                    startsRun={newDay || isFirstUnread || startsRun(message, previous)}
                    showSenderDetails={isGroup}
                    highlighted={message.id === highlightedId}
                    menu={menu}
                    readState={
                      message.sender?.id === currentUserId && !message.delivery
                        ? readStateOf(message, memberIds, readPositions)
                        : undefined
                    }
                    nameOf={nameOf}
                    onJump={(messageId) => void jumpToMessage(conversationId, messageId)}
                    onRetry={() => message.clientId && void retry(conversationId, message.clientId)}
                    onDiscard={() => message.clientId && discard(conversationId, message.clientId)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showJump && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-4 right-4 flex h-11 items-center gap-2 rounded-full bg-paper-raised px-4 text-sm font-semibold text-pine-700 shadow-card ring-1 ring-line"
        >
          {unseenCount > 0 && `${unseenCount} new`}
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Jump to latest messages</span>
        </button>
      )}
    </div>
  );
}
