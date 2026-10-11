import { History } from 'lucide-react';
import { useCallback, useState } from 'react';
import { listImports } from '../../../../api/imports.api';
import { Button } from '../../../../components/ui/Button';
import { LoadError } from '../../../../components/ui/LoadError';
import { Spinner } from '../../../../components/ui/Spinner';
import { useApiResource } from '../../../../hooks/useApiResource';
import { formatRelative } from '../../../../utils/time';
import { ImportChatDialog } from './ImportChatDialog';

/** Past WhatsApp imports for a group, and the way to add one. */
export function ChatImportsPanel({ groupId }: { groupId: string }) {
  const load = useCallback(() => listImports(groupId), [groupId]);
  const { state, reload, setData } = useApiResource(load);
  const [importing, setImporting] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">WhatsApp history</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Bring messages from the batch’s old WhatsApp group into this group.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
          <History className="h-4 w-4" aria-hidden="true" />
          Import WhatsApp chat
        </Button>
      </div>

      <div className="mt-4">
        {state.phase === 'loading' && <Spinner className="h-4 w-4 text-pine-600" />}
        {state.phase === 'error' && <LoadError message={state.message} onRetry={reload} />}
        {state.phase === 'ready' &&
          (state.data.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing imported yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {state.data.map((record) => (
                <li key={record.id} className="py-2">
                  <span className="font-medium">{record.fileName}</span>
                  <span className="block text-ink-muted">
                    {record.importedCount} messages imported
                    {record.skippedCount > 0 && `, ${record.skippedCount} skipped`} by{' '}
                    {record.importedBy?.name ?? 'an admin'} · {formatRelative(record.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </div>

      {importing && (
        <ImportChatDialog
          groupId={groupId}
          onImported={(record) => setData([record, ...(state.phase === 'ready' ? state.data : [])])}
          onClose={() => setImporting(false)}
        />
      )}
    </section>
  );
}
