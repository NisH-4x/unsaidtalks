import { ChevronRight, MessageCircleOff, MessagesSquare, Plus, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listGroups } from '../../../api/admin.api';
import { EmptyState } from '../../../components/ui/EmptyState';
import { GroupAvatar } from '../../../components/ui/GroupAvatar';
import { LoadError } from '../../../components/ui/LoadError';
import { Spinner } from '../../../components/ui/Spinner';
import { useApiResource } from '../../../hooks/useApiResource';
import { AdminGroupSummary } from '../../../types/conversation';
import { formatRelative } from '../../../utils/time';
import { PageHeader } from '../PageHeader';

const NEW_GROUP_LINK =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pine-600 px-4 text-sm font-semibold text-paper-raised shadow-sm hover:bg-pine-700';

function GroupCard({ group }: { group: AdminGroupSummary }) {
  const subtitle = [group.program, group.batch].filter(Boolean).join(' · ');

  return (
    <li>
      <Link
        to={`/admin/groups/${group.id}`}
        className="flex items-center gap-4 rounded-2xl border border-line bg-paper-raised p-4 shadow-card transition-colors hover:border-pine-300"
      >
        <GroupAvatar name={group.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{group.name}</p>
          {subtitle && <p className="truncate text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
              {group.mentorCount} mentors · {group.menteeCount} mentees
            </span>
            <span className="inline-flex items-center gap-1">
              {group.allowMenteeDirectChat ? (
                <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <MessageCircleOff className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Mentee chats {group.allowMenteeDirectChat ? 'on' : 'off'}
            </span>
            <span>Active {formatRelative(group.lastActivityAt)}</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function GroupsPage() {
  const { state, reload } = useApiResource(listGroups);

  return (
    <>
      <PageHeader
        title="Program groups"
        description="One group per program or batch. Add mentors and mentees, and decide whether mentees may message each other privately."
        action={
          <Link to="/admin/groups/new" className={NEW_GROUP_LINK}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New group
          </Link>
        }
      />

      {state.phase === 'loading' && (
        <div className="flex justify-center py-12 text-pine-600">
          <Spinner />
        </div>
      )}
      {state.phase === 'error' && <LoadError message={state.message} onRetry={reload} />}
      {state.phase === 'ready' && state.data.length === 0 && (
        <EmptyState
          icon={<UsersRound className="h-8 w-8 text-ink-faint" aria-hidden="true" />}
          title="No groups yet"
          className="rounded-2xl border border-dashed border-line-strong"
        >
          Create a group for each program or batch, for example &ldquo;TCS NQT Prep – Batch
          12&rdquo;.
        </EmptyState>
      )}
      {state.phase === 'ready' && state.data.length > 0 && (
        <ul className="space-y-3">
          {state.data.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </ul>
      )}
    </>
  );
}
