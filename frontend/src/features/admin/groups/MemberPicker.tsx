import { Check } from 'lucide-react';
import { useCallback, useState } from 'react';
import { listUsers } from '../../../api/admin.api';
import { Avatar } from '../../../components/ui/Avatar';
import { LoadError } from '../../../components/ui/LoadError';
import { RoleBadge } from '../../../components/ui/RoleBadge';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Spinner } from '../../../components/ui/Spinner';
import { useApiResource } from '../../../hooks/useApiResource';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { AdminUser } from '../../../types/user';
import { cn } from '../../../utils/cn';

type RoleFilter = 'all' | 'mentor' | 'mentee';

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'mentor', label: 'Mentors' },
  { value: 'mentee', label: 'Mentees' },
];

interface MemberPickerProps {
  excludeIds: ReadonlySet<string>;
  selected: ReadonlyMap<string, AdminUser>;
  onToggle: (user: AdminUser) => void;
}

/** Searches active mentors and mentees; people already in the group are left out. */
export function MemberPicker({ excludeIds, selected, onToggle }: MemberPickerProps) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const debouncedQuery = useDebouncedValue(query.trim());

  const load = useCallback(
    () =>
      listUsers({
        status: 'active',
        q: debouncedQuery || undefined,
        role: role === 'all' ? undefined : role,
      }),
    [debouncedQuery, role],
  );
  const { state, reload } = useApiResource(load);

  const candidates =
    state.phase === 'ready'
      ? state.data.filter((user) => user.role !== 'admin' && !excludeIds.has(user.id))
      : [];

  return (
    <div className="space-y-3">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by name or email"
        label="Search people"
      />
      <div className="flex gap-2">
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

      <div className="max-h-80 overflow-y-auto rounded-xl border border-line bg-paper-raised">
        {state.phase === 'loading' && (
          <div className="flex justify-center py-8 text-pine-600">
            <Spinner />
          </div>
        )}
        {state.phase === 'error' && (
          <div className="p-3">
            <LoadError message={state.message} onRetry={reload} />
          </div>
        )}
        {state.phase === 'ready' && candidates.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            No one else matches. Only active mentors and mentees can be added.
          </p>
        )}
        <ul className="divide-y divide-line">
          {candidates.map((user) => {
            const isSelected = selected.has(user.id);
            return (
              <li key={user.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => onToggle(user)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                    isSelected ? 'bg-pine-50' : 'hover:bg-paper-sunk/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                      isSelected ? 'border-pine-600 bg-pine-600' : 'border-line-strong',
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-paper-raised" />}
                  </span>
                  <Avatar name={user.name} seed={user.id} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-ink-muted">{user.email}</span>
                  </span>
                  <RoleBadge role={user.role} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
