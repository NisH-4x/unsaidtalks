import { UsersRound } from 'lucide-react';
import { useCallback, useState } from 'react';
import { listUsers, updateUser } from '../../../api/admin.api';
import { toApiError } from '../../../api/errors';
import { Alert } from '../../../components/ui/Alert';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadError } from '../../../components/ui/LoadError';
import { RoleBadge } from '../../../components/ui/RoleBadge';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Spinner } from '../../../components/ui/Spinner';
import { useApiResource } from '../../../hooks/useApiResource';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { AccountStatus, AdminUser, UserRole } from '../../../types/user';
import { cn } from '../../../utils/cn';
import { PageHeader } from '../PageHeader';

type RoleFilter = 'all' | UserRole;

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'mentor', label: 'Mentors' },
  { value: 'mentee', label: 'Mentees' },
  { value: 'admin', label: 'Admins' },
];

const STATUS_LABELS: Record<AccountStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-pine-50 text-pine-700' },
  pending_approval: { label: 'Pending approval', className: 'bg-marigold-50 text-marigold-700' },
  rejected: { label: 'Rejected', className: 'bg-paper-sunk text-ink-muted' },
  deactivated: { label: 'Deactivated', className: 'bg-clay-50 text-clay-600' },
};

interface UserRowProps {
  user: AdminUser;
  busy: boolean;
  onChange: (changes: Parameters<typeof updateUser>[1]) => void;
}

function UserRow({ user, busy, onChange }: UserRowProps) {
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);
  const status = STATUS_LABELS[user.status];
  const manageable =
    user.role !== 'admin' && (user.status === 'active' || user.status === 'deactivated');

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-paper-raised p-4 shadow-card sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={user.name} seed={user.id} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{user.name}</span>
            <RoleBadge role={user.role} />
            <span
              className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', status.className)}
            >
              {status.label}
            </span>
          </p>
          <p className="truncate text-sm text-ink-muted">{user.email}</p>
        </div>
      </div>

      {manageable && confirmingDeactivation && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-sm text-ink-soft sm:w-auto">
            Deactivate {user.name.split(' ')[0]}?
          </span>
          <Button
            size="sm"
            variant="danger"
            loading={busy}
            onClick={() => onChange({ status: 'deactivated' })}
            className="flex-1 sm:flex-none"
          >
            Yes, deactivate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirmingDeactivation(false)}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
        </div>
      )}
      {manageable && !confirmingDeactivation && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => onChange({ role: user.role === 'mentor' ? 'mentee' : 'mentor' })}
            className="flex-1 sm:flex-none"
          >
            Make {user.role === 'mentor' ? 'mentee' : 'mentor'}
          </Button>
          {user.status === 'active' ? (
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => setConfirmingDeactivation(true)}
              className="flex-1 sm:flex-none"
            >
              Deactivate
            </Button>
          ) : (
            <Button
              size="sm"
              loading={busy}
              onClick={() => onChange({ status: 'active' })}
              className="flex-1 sm:flex-none"
            >
              Reactivate
            </Button>
          )}
        </div>
      )}
      {user.status === 'pending_approval' && (
        <p className="text-sm text-ink-muted">Decide on the Mentor requests tab.</p>
      )}
    </li>
  );
}

export function UsersPage() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const debouncedQuery = useDebouncedValue(query.trim());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(
    () => listUsers({ q: debouncedQuery || undefined, role: role === 'all' ? undefined : role }),
    [debouncedQuery, role],
  );
  const { state, reload, setData } = useApiResource(load);

  async function change(user: AdminUser, changes: Parameters<typeof updateUser>[1]) {
    setBusyId(user.id);
    setNotice(null);
    try {
      const updated = await updateUser(user.id, changes);
      if (state.phase === 'ready') {
        setData(state.data.map((existing) => (existing.id === updated.id ? updated : existing)));
      }
      const what = changes.role
        ? `is now a ${updated.role}`
        : updated.status === 'active'
          ? 'can sign in again'
          : 'has been deactivated and signed out everywhere';
      setNotice({ tone: 'success', text: `${updated.name} ${what}.` });
    } catch (caught) {
      setNotice({ tone: 'error', text: toApiError(caught).message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with an account. Change a person's role or deactivate an account; deactivation signs them out immediately."
      />

      <div className="mb-5 space-y-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by name or email"
          label="Search users"
        />
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={role === option.value}
              onClick={() => setRole(option.value)}
              className={cn(
                'h-8 rounded-full px-3.5 text-sm font-medium transition-colors',
                role === option.value
                  ? 'bg-pine-600 text-paper-raised'
                  : 'bg-paper-sunk text-ink-muted hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <Alert tone={notice.tone} className="mb-5">
          {notice.text}
        </Alert>
      )}

      {state.phase === 'loading' && (
        <div className="flex justify-center py-12 text-pine-600">
          <Spinner />
        </div>
      )}
      {state.phase === 'error' && <LoadError message={state.message} onRetry={reload} />}
      {state.phase === 'ready' && state.data.length === 0 && (
        <EmptyState
          icon={<UsersRound className="h-8 w-8 text-ink-faint" aria-hidden="true" />}
          title="No users found"
        >
          Try a different search or filter.
        </EmptyState>
      )}
      {state.phase === 'ready' && state.data.length > 0 && (
        <ul className="space-y-3">
          {state.data.map((user) => (
            <UserRow
              key={`${user.id}-${user.status}`}
              user={user}
              busy={busyId === user.id}
              onChange={(changes) => void change(user, changes)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
