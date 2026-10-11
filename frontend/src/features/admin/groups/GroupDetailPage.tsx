import { ArrowLeft, MessagesSquare } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getGroup } from '../../../api/admin.api';
import { Alert } from '../../../components/ui/Alert';
import { LoadError } from '../../../components/ui/LoadError';
import { Spinner } from '../../../components/ui/Spinner';
import { useApiResource } from '../../../hooks/useApiResource';
import { PageHeader } from '../PageHeader';
import { GroupDetailsEditor } from './GroupDetailsEditor';
import { GroupMembersPanel } from './GroupMembersPanel';
import { ChatImportsPanel } from './imports/ChatImportsPanel';

export function GroupDetailPage() {
  const { groupId = '' } = useParams();
  const location = useLocation();
  const justCreated = Boolean((location.state as { created?: boolean } | null)?.created);
  const load = useCallback(() => getGroup(groupId), [groupId]);
  const { state, reload, setData } = useApiResource(load);

  return (
    <>
      <Link
        to="/admin/groups"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All groups
      </Link>

      {state.phase === 'loading' && (
        <div className="flex justify-center py-16 text-pine-600">
          <Spinner />
        </div>
      )}
      {state.phase === 'error' && (
        <div className="mt-6">
          <LoadError message={state.message} onRetry={reload} />
        </div>
      )}
      {state.phase === 'ready' && (
        <>
          <PageHeader
            title={state.data.name}
            description={[state.data.program, state.data.batch].filter(Boolean).join(' · ')}
            action={
              <Link
                to={`/chats/${state.data.id}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-paper-raised px-4 text-sm font-semibold text-ink hover:bg-paper-sunk"
              >
                <MessagesSquare className="h-4 w-4 text-pine-600" aria-hidden="true" />
                Open in chats
              </Link>
            }
          />
          {justCreated && (
            <Alert tone="success" className="mb-6">
              Group created. Members can now see it in their chat list.
            </Alert>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <GroupDetailsEditor key={state.data.id} group={state.data} onSaved={setData} />
            <GroupMembersPanel group={state.data} onChanged={setData} />
          </div>
          <div className="mt-6">
            <ChatImportsPanel groupId={state.data.id} />
          </div>
        </>
      )}
    </>
  );
}
