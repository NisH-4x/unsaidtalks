import { UserRoundSearch } from 'lucide-react';
import { useCallback, useState } from 'react';
import { DirectContact, listDirectContacts } from '../../api/directChats.api';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadError } from '../../components/ui/LoadError';
import { Dialog } from '../../components/ui/Dialog';
import { RoleBadge } from '../../components/ui/RoleBadge';
import { SearchInput } from '../../components/ui/SearchInput';
import { Spinner } from '../../components/ui/Spinner';
import { useApiResource } from '../../hooks/useApiResource';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAuthStore } from '../../store/auth.store';
import { useIsOnline } from '../../store/presence.store';
import { UserRole } from '../../types/user';
import { useStartChat } from './useStartChat';

const EMPTY_HINT: Record<UserRole, string> = {
  mentee:
    'You can message the mentors of your program groups. Other mentees appear here only in groups where an admin allows it.',
  mentor: 'You can message the mentees and co-mentors of your program groups.',
  admin: 'No active users match your search.',
};

function ContactRow({
  contact,
  busy,
  onPick,
}: {
  contact: DirectContact;
  busy: boolean;
  onPick: () => void;
}) {
  const online = useIsOnline(contact.id);

  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper-sunk/70 disabled:opacity-60"
      >
        <Avatar name={contact.name} seed={contact.id} online={online} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{contact.name}</span>
          <span className="block text-xs text-ink-muted">
            {online ? 'online' : contact.conversationId ? 'Open your chat' : 'Start a chat'}
          </span>
        </span>
        {busy ? <Spinner className="h-4 w-4 text-pine-600" /> : <RoleBadge role={contact.role} />}
      </button>
    </li>
  );
}

export function NewChatDialog({ onClose }: { onClose: () => void }) {
  const role = useAuthStore((state) => state.user?.role ?? 'mentee');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim());
  const load = useCallback(() => listDirectContacts(debouncedQuery || undefined), [debouncedQuery]);
  const { state, reload } = useApiResource(load);
  const { start, startingWith, error } = useStartChat();

  async function pick(contact: DirectContact) {
    if (await start(contact.id)) onClose();
  }

  return (
    <Dialog title="New chat" onClose={onClose}>
      <div className="border-b border-line p-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search people"
          label="Search people to message"
        />
      </div>
      {error && (
        <Alert tone="error" className="mx-4 mt-4">
          {error}
        </Alert>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.phase === 'loading' && (
          <div className="flex justify-center py-10 text-pine-600">
            <Spinner />
          </div>
        )}
        {state.phase === 'error' && (
          <div className="p-4">
            <LoadError message={state.message} onRetry={reload} />
          </div>
        )}
        {state.phase === 'ready' && state.data.length === 0 && (
          <EmptyState
            icon={<UserRoundSearch className="h-8 w-8 text-ink-faint" aria-hidden="true" />}
            title={debouncedQuery ? 'No one matches' : 'No one to message yet'}
          >
            {EMPTY_HINT[role]}
          </EmptyState>
        )}
        {state.phase === 'ready' && state.data.length > 0 && (
          <ul className="divide-y divide-line py-1" aria-label="People you can message">
            {state.data.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                busy={startingWith === contact.id}
                onPick={() => void pick(contact)}
              />
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
