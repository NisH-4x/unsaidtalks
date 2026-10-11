import { FormEvent, useState } from 'react';
import { toApiError } from '../../../api/errors';
import { reportMessage } from '../../../api/reports.api';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { showToast } from '../../../store/toast.store';
import { Message } from '../../../types/message';
import { ReportReason } from '../../../types/report';
import { messageSummary } from '../../../utils/attachments';
import { cn } from '../../../utils/cn';
import { REPORT_REASON_LABELS } from '../../../utils/reportReasons';

const NOTE_LIMIT = 500;

export function ReportMessageDialog({
  message,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason) return;
    setSending(true);
    setError(null);
    try {
      await reportMessage(message.id, { reason, note: note.trim() || undefined });
      showToast('Thanks for reporting. An admin will review the message.', 'success');
      onClose();
    } catch (failure) {
      setError(toApiError(failure).message);
      setSending(false);
    }
  }

  return (
    <Dialog title="Report message" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <blockquote className="line-clamp-3 rounded-xl border-l-[3px] border-line-strong bg-paper-sunk/70 px-3 py-2 text-sm text-ink-muted">
            <span className="font-semibold text-ink-soft">{message.sender?.name}: </span>
            {messageSummary(message)}
          </blockquote>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">What is wrong with it?</legend>
            <div className="mt-2 space-y-2">
              {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((value) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                    reason === value
                      ? 'border-pine-400 bg-pine-50 text-pine-800'
                      : 'border-line hover:bg-paper-sunk',
                  )}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="h-4 w-4 accent-pine-600"
                  />
                  {REPORT_REASON_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-sm font-semibold text-ink">Anything the admin should know?</span>
            <span className="text-sm text-ink-muted"> (optional)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={NOTE_LIMIT}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-line bg-paper-raised px-3 py-2 text-base text-ink focus:border-pine-400 focus:outline-none focus:ring-4 focus:ring-pine-100"
            />
          </label>
          <p className="text-xs text-ink-muted">
            Only admins see reports. The person you report is not told who reported them.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" loading={sending} disabled={!reason}>
            Send report
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
