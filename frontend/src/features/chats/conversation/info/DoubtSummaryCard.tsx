import { RefreshCw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DoubtSummary, summariseDoubts } from '../../../../api/ai.api';
import { toApiError } from '../../../../api/errors';
import { Alert } from '../../../../components/ui/Alert';
import { Button } from '../../../../components/ui/Button';
import { Spinner } from '../../../../components/ui/Spinner';
import { formatRelative } from '../../../../utils/time';

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; summary: DoubtSummary };

interface DoubtSummaryCardProps {
  conversationId: string;
  onOpenMessage: (messageId: string) => void;
  startNow?: boolean;
}

function SummaryBody({
  summary,
  onOpenMessage,
}: {
  summary: DoubtSummary;
  onOpenMessage: (messageId: string) => void;
}) {
  if (summary.status === 'empty') {
    return <p className="text-sm text-ink-muted">There are no open doubts to summarise.</p>;
  }
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-marigold-50 px-3 py-2 text-xs font-medium text-marigold-700">
        AI-generated and may be inaccurate. Check the original doubts before replying.
      </p>
      {summary.overview && (
        <p className="text-sm leading-relaxed text-ink-soft">{summary.overview}</p>
      )}
      <ol className="space-y-3">
        {summary.topics.map((topic) => (
          <li key={topic.title} className="rounded-xl border border-line bg-paper p-3">
            <p className="text-sm font-semibold">{topic.title}</p>
            {topic.summary && <p className="mt-1 text-sm text-ink-soft">{topic.summary}</p>}
            <ul className="mt-2 space-y-1.5">
              {topic.doubts.map((doubt) => (
                <li key={doubt.messageId} className="flex items-start gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{doubt.askedBy}:</span>{' '}
                    <span className="text-ink-muted">{doubt.preview}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenMessage(doubt.messageId)}
                    className="shrink-0 text-xs font-semibold text-pine-700 hover:underline"
                  >
                    Go to doubt
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-faint">
        Based on {summary.doubtCount} open {summary.doubtCount === 1 ? 'doubt' : 'doubts'}
        {summary.omittedCount > 0 && ` (${summary.omittedCount} older ones not included)`}
        {summary.model && ` · ${summary.model}`}
        {summary.generatedAt && ` · ${formatRelative(summary.generatedAt)}`}
      </p>
    </div>
  );
}

/** For mentors and admins: an AI overview of the open doubts, generated only when asked. */
export function DoubtSummaryCard({
  conversationId,
  onOpenMessage,
  startNow = false,
}: DoubtSummaryCardProps) {
  const [state, setState] = useState<State>({ phase: startNow ? 'loading' : 'idle' });

  const fetchSummary = useCallback(
    () =>
      summariseDoubts(conversationId).then(
        (summary) => setState({ phase: 'ready', summary }),
        (error: unknown) => setState({ phase: 'error', message: toApiError(error).message }),
      ),
    [conversationId],
  );

  function generate() {
    setState({ phase: 'loading' });
    void fetchSummary();
  }

  useEffect(() => {
    if (startNow) void fetchSummary();
  }, [startNow, fetchSummary]);

  return (
    <section
      aria-label="AI summary of open doubts"
      className="rounded-xl border border-line bg-paper-raised p-3 shadow-bubble"
    >
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-marigold-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">AI summary of open doubts</h3>
          {state.phase === 'idle' && (
            <p className="mt-0.5 text-sm text-ink-muted">
              Groups similar questions so you can answer them together.
            </p>
          )}
        </div>
        {state.phase === 'ready' && state.summary.status === 'ready' && (
          <button
            type="button"
            onClick={generate}
            aria-label="Summarise again"
            title="Summarise again"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-paper-sunk"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-3">
        {state.phase === 'idle' && (
          <Button size="sm" variant="secondary" onClick={generate}>
            Summarise open doubts
          </Button>
        )}
        {state.phase === 'loading' && (
          <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
            <Spinner className="h-4 w-4" />
            Summarising open doubts… this can take a few seconds.
          </p>
        )}
        {state.phase === 'error' && (
          <div className="space-y-2">
            <Alert tone="error">{state.message}</Alert>
            <Button size="sm" variant="secondary" onClick={generate}>
              Try again
            </Button>
          </div>
        )}
        {state.phase === 'ready' && (
          <SummaryBody summary={state.summary} onOpenMessage={onOpenMessage} />
        )}
      </div>
    </section>
  );
}
