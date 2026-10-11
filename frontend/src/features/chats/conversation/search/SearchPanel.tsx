import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { Highlighted } from '../../../../components/Highlighted';
import { Button } from '../../../../components/ui/Button';
import { LoadError } from '../../../../components/ui/LoadError';
import { RoleBadge } from '../../../../components/ui/RoleBadge';
import { Spinner } from '../../../../components/ui/Spinner';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { Message } from '../../../../types/message';
import { messageSummary } from '../../../../utils/attachments';
import { searchTerms } from '../../../../utils/search';
import { formatChatTime, formatMessageTime } from '../../../../utils/time';
import { MIN_SEARCH_LENGTH, useMessageSearch } from './useMessageSearch';

interface SearchPanelProps {
  conversationId: string;
  onOpenMessage: (messageId: string) => void;
  onClose: () => void;
}

function SearchResultRow({
  message,
  terms,
  onOpen,
}: {
  message: Message;
  terms: string[];
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full px-4 py-3 text-left transition-colors hover:bg-paper-sunk"
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">
            {message.sender?.name ?? 'Unknown sender'}
          </span>
          {message.sender && <RoleBadge role={message.sender.role} />}
          <time dateTime={message.createdAt} className="ml-auto shrink-0 text-xs text-ink-faint">
            {formatChatTime(message.createdAt)}, {formatMessageTime(message.createdAt)}
          </time>
        </span>
        <span className="mt-1 line-clamp-3 block whitespace-pre-wrap break-words text-sm text-ink-soft">
          <Highlighted text={messageSummary(message)} terms={terms} />
        </span>
      </button>
    </li>
  );
}

/** Searches every message in the conversation. Full screen on phones, a side panel on wide screens. */
export function SearchPanel({ conversationId, onOpenMessage, onClose }: SearchPanelProps) {
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim(), 300);
  const search = useMessageSearch(conversationId, query);
  const terms = searchTerms(query);

  return (
    <aside
      aria-label="Search messages"
      className="fixed inset-0 z-30 flex flex-col bg-paper lg:static lg:z-auto lg:w-96 lg:shrink-0 lg:border-l lg:border-line"
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-paper-raised px-3">
        <label className="relative flex-1">
          <span className="sr-only">Search messages</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoFocus
            maxLength={100}
            placeholder="Search this chat"
            className="h-10 w-full rounded-xl border border-line bg-paper-sunk/60 pl-9 pr-3 text-base text-ink placeholder:text-ink-faint focus:border-pine-400 focus:bg-paper-raised focus:outline-none focus:ring-4 focus:ring-pine-100"
          />
        </label>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-paper-sunk"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {search.status === 'idle' && (
          <p className="px-6 py-10 text-center text-sm leading-relaxed text-ink-muted">
            {input.trim().length > 0 && input.trim().length < MIN_SEARCH_LENGTH
              ? 'Type at least 2 characters.'
              : 'Search every message and file name in this chat, including older history.'}
          </p>
        )}
        {search.status === 'loading' && (
          <div className="flex justify-center py-10 text-pine-600">
            <Spinner />
          </div>
        )}
        {search.status === 'error' && (
          <div className="p-4">
            <LoadError message={search.error ?? 'Search failed.'} onRetry={search.retry} />
          </div>
        )}
        {search.status === 'ready' && search.messages.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-ink-muted">
            No messages match “{query}”.
          </p>
        )}
        {search.messages.length > 0 && (
          <ul className="divide-y divide-line">
            {search.messages.map((message) => (
              <SearchResultRow
                key={message.id}
                message={message}
                terms={terms}
                onOpen={() => onOpenMessage(message.id)}
              />
            ))}
          </ul>
        )}
        {search.hasMore && (
          <div className="flex justify-center p-3">
            <Button
              variant="ghost"
              size="sm"
              loading={search.loadingMore}
              onClick={() => void search.loadMore()}
            >
              Show older matches
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
