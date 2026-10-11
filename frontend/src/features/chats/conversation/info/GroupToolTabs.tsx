import { useCallback, useState } from 'react';
import {
  DoubtStatus,
  listAnnouncements,
  listDoubts,
  listPins,
} from '../../../../api/messageTools.api';
import { UserRole } from '../../../../types/user';
import { cn } from '../../../../utils/cn';
import { canAskDoubts, canPinMessages, canResolveDoubts } from '../../../../utils/permissions';
import { DoubtChip } from '../DoubtChip';
import { messageActions } from '../messageActions';
import { DoubtSummaryCard } from './DoubtSummaryCard';
import { ActionButton, ToolMessageList } from './ToolMessageList';

export interface GroupToolTabProps {
  conversationId: string;
  viewer: { id: string; role: UserRole };
  nameOf: (userId: string) => string | undefined;
  onOpenMessage: (messageId: string) => void;
  /** Doubts tab only: start the AI summary as soon as the tab opens. */
  startSummary?: boolean;
}

export function PinnedTab({ conversationId, viewer, onOpenMessage }: GroupToolTabProps) {
  const load = useCallback(() => listPins(conversationId), [conversationId]);
  const canUnpin = canPinMessages(viewer.role, 'group');

  return (
    <ToolMessageList
      load={load}
      emptyText={
        canUnpin
          ? 'Nothing pinned yet. Pin important messages from their menu so they stay at the top.'
          : 'Nothing pinned yet. Mentors pin important messages here.'
      }
      onOpenMessage={onOpenMessage}
      renderActions={
        canUnpin
          ? (message) => <ActionButton label="Unpin" onRun={() => messageActions.unpin(message)} />
          : undefined
      }
    />
  );
}

export function AnnouncementsTab({ conversationId, onOpenMessage }: GroupToolTabProps) {
  const load = useCallback(() => listAnnouncements(conversationId), [conversationId]);
  return (
    <ToolMessageList load={load} emptyText="No announcements yet." onOpenMessage={onOpenMessage} />
  );
}

type DoubtFilter = DoubtStatus | 'all';

const FILTERS: Array<{ value: DoubtFilter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const EMPTY_TEXT: Record<DoubtFilter, string> = {
  open: 'No open doubts right now.',
  resolved: 'No resolved doubts yet.',
  all: 'No doubts yet. Mentees can use Ask as doubt, or mark one of their own messages as a doubt.',
};

function DoubtList({ filter, ...props }: GroupToolTabProps & { filter: DoubtFilter }) {
  const { conversationId, viewer, nameOf, onOpenMessage } = props;
  const load = useCallback(
    () => listDoubts(conversationId, filter === 'all' ? undefined : filter),
    [conversationId, filter],
  );
  const canResolve = canResolveDoubts(viewer.role, 'group');
  const canAsk = canAskDoubts(viewer.role, 'group');

  return (
    <ToolMessageList
      load={load}
      emptyText={EMPTY_TEXT[filter]}
      onOpenMessage={onOpenMessage}
      renderBadge={(message) =>
        message.doubt && (
          <DoubtChip
            doubt={message.doubt}
            resolverName={message.doubt.resolvedBy ? nameOf(message.doubt.resolvedBy) : undefined}
          />
        )
      }
      renderActions={(message) => {
        const status = message.doubt?.status;
        if (canResolve) {
          return status === 'open' ? (
            <ActionButton
              label="Mark resolved"
              onRun={() => messageActions.resolveDoubt(message)}
            />
          ) : (
            <ActionButton label="Reopen" onRun={() => messageActions.reopenDoubt(message)} />
          );
        }
        if (canAsk && status === 'open' && message.sender?.id === viewer.id) {
          return (
            <ActionButton label="Remove doubt" onRun={() => messageActions.unmarkDoubt(message)} />
          );
        }
        return null;
      }}
    />
  );
}

export function DoubtsTab(props: GroupToolTabProps) {
  const [filter, setFilter] = useState<DoubtFilter>('open');

  return (
    <div className="space-y-4">
      {canResolveDoubts(props.viewer.role, 'group') && (
        <DoubtSummaryCard
          conversationId={props.conversationId}
          onOpenMessage={props.onOpenMessage}
          startNow={props.startSummary}
        />
      )}
      <div role="radiogroup" aria-label="Show doubts" className="flex rounded-xl bg-paper-sunk p-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'h-9 flex-1 rounded-lg text-sm font-semibold transition-colors',
              filter === value
                ? 'bg-paper-raised text-pine-700 shadow-bubble'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Keyed so a new filter starts from a loading state instead of showing the old list. */}
      <DoubtList key={filter} filter={filter} {...props} />
    </div>
  );
}
