import { MessageSquarePlus, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadError } from '../../components/ui/LoadError';
import { SearchInput } from '../../components/ui/SearchInput';
import { useAuthStore } from '../../store/auth.store';
import { useChatsStore } from '../../store/chats.store';
import { ConversationType } from '../../types/conversation';
import { cn } from '../../utils/cn';
import { ChatListRow } from './ChatListRow';
import { NewChatDialog } from './NewChatDialog';
import { NoChatsYet } from './NoChatsYet';

type Filter = 'all' | ConversationType;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'group', label: 'Groups' },
  { value: 'direct', label: 'Direct' },
];

function LoadingRows() {
  return (
    <div className="space-y-1 px-3" aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex animate-pulse items-center gap-3 py-3">
          <div className="h-12 w-12 rounded-2xl bg-paper-sunk" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-paper-sunk" />
            <div className="h-3 w-5/6 rounded bg-paper-sunk" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatList({ selectedId }: { selectedId?: string }) {
  const user = useAuthStore((state) => state.user);
  const { status, conversations, error, load } = useChatsStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [composing, setComposing] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter(
      (chat) =>
        (filter === 'all' || chat.type === filter) &&
        (!needle || chat.title.toLowerCase().includes(needle)),
    );
  }, [conversations, filter, query]);

  if (!user) return null;
  const hasChats = conversations.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 px-4 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[1.75rem] font-medium tracking-tight">Chats</h1>
          <button
            type="button"
            onClick={() => setComposing(true)}
            aria-label="New chat"
            title="New chat"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine-50 text-pine-700 hover:bg-pine-100"
          >
            <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {composing && <NewChatDialog onClose={() => setComposing(false)} />}
        {hasChats && (
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search chats"
              label="Search chats"
            />
            <div className="flex gap-2" role="tablist" aria-label="Filter chats">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    'h-8 rounded-full px-3.5 text-sm font-medium transition-colors',
                    filter === option.value
                      ? 'bg-pine-600 text-paper-raised'
                      : 'bg-paper-sunk text-ink-muted hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4">
        {status === 'loading' && <LoadingRows />}
        {status === 'error' && error && (
          <div className="px-3">
            <LoadError message={error} onRetry={() => void load(user.id)} />
          </div>
        )}
        {status === 'ready' && !hasChats && (
          <NoChatsYet firstName={user.name.split(' ')[0]} role={user.role} />
        )}
        {status === 'ready' && hasChats && visible.length === 0 && (
          <EmptyState
            icon={<SearchX className="h-8 w-8 text-ink-faint" aria-hidden="true" />}
            title="No matching chats"
          >
            Try a different name or filter.
          </EmptyState>
        )}
        {visible.length > 0 && (
          <nav aria-label="Conversations" className="space-y-0.5 px-2">
            {visible.map((chat) => (
              <ChatListRow
                key={chat.id}
                chat={chat}
                currentUserId={user.id}
                selected={chat.id === selectedId}
              />
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
