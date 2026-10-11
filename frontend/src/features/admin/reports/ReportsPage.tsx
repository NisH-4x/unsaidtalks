import { ShieldCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toApiError } from '../../../api/errors';
import { decideReport, listReports } from '../../../api/reports.api';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadError } from '../../../components/ui/LoadError';
import { Spinner } from '../../../components/ui/Spinner';
import { useApiResource } from '../../../hooks/useApiResource';
import { showToast } from '../../../store/toast.store';
import { ReportDecision, ReportStatus } from '../../../types/report';
import { cn } from '../../../utils/cn';
import { AdminOutletContext } from '../AdminLayout';
import { PageHeader } from '../PageHeader';
import { ReportCard } from './ReportCard';

const TABS: Array<{ status: ReportStatus; label: string; empty: string }> = [
  { status: 'open', label: 'Open', empty: 'Nothing to review. Reported messages appear here.' },
  { status: 'actioned', label: 'Removed', empty: 'No reported messages have been removed yet.' },
  { status: 'dismissed', label: 'Dismissed', empty: 'No reports have been dismissed yet.' },
];

function ReportList({ status, empty }: { status: ReportStatus; empty: string }) {
  const load = useCallback(() => listReports(status), [status]);
  const { state, reload, setData } = useApiResource(load);
  const { refreshReportCount } = useOutletContext<AdminOutletContext>();

  if (state.phase === 'loading') {
    return (
      <div className="flex justify-center py-16 text-pine-600">
        <Spinner />
      </div>
    );
  }
  if (state.phase === 'error') return <LoadError message={state.message} onRetry={reload} />;
  if (state.data.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-10 w-10 text-pine-500" aria-hidden="true" />}
        title="All clear"
      >
        {empty}
      </EmptyState>
    );
  }

  const items = state.data;
  async function decide(messageId: string, decision: ReportDecision) {
    try {
      await decideReport(messageId, decision);
      setData(items.filter((item) => item.messageId !== messageId));
      refreshReportCount();
      showToast(decision === 'dismiss' ? 'Report dismissed' : 'Message removed', 'success');
    } catch (error) {
      showToast(toApiError(error).message, 'error');
    }
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <ReportCard
          key={item.messageId}
          item={item}
          onDecide={(decision) => decide(item.messageId, decision)}
        />
      ))}
    </ul>
  );
}

export function ReportsPage() {
  const [status, setStatus] = useState<ReportStatus>('open');
  const active = TABS.find((tab) => tab.status === status) ?? TABS[0];

  return (
    <div>
      <PageHeader
        title="Reported messages"
        description="Review what was reported. Delete the message for everyone, or dismiss the report if it is fine."
      />
      <div role="radiogroup" aria-label="Show reports" className="mb-5 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            role="radio"
            aria-checked={status === tab.status}
            onClick={() => setStatus(tab.status)}
            className={cn(
              'h-9 rounded-full px-4 text-sm font-semibold transition-colors',
              status === tab.status
                ? 'bg-pine-600 text-paper-raised'
                : 'bg-paper-sunk text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Keyed so that switching tabs starts from a loading state, not the previous list. */}
      <ReportList key={status} status={status} empty={active.empty} />
    </div>
  );
}
