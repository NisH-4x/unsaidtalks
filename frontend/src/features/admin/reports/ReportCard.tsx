import { Download, ExternalLink, FileText, Lock, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchFile } from '../../../api/attachments.api';
import { toApiError } from '../../../api/errors';
import { reportedAttachmentPath } from '../../../api/reports.api';
import { Button } from '../../../components/ui/Button';
import { RoleBadge } from '../../../components/ui/RoleBadge';
import { useFileUrl } from '../../../hooks/useFileUrl';
import { showToast } from '../../../store/toast.store';
import { ReportDecision, ReportedMessage } from '../../../types/report';
import { formatFileSize, isImageType } from '../../../utils/attachments';
import { saveBlob } from '../../../utils/download';
import { REPORT_REASON_LABELS } from '../../../utils/reportReasons';
import { formatRelative } from '../../../utils/time';

function ReportedAttachment({ item }: { item: ReportedMessage }) {
  const attachment = item.message.attachment;
  const image = attachment && isImageType(attachment.mimeType);
  const file = useFileUrl(image ? reportedAttachmentPath(item.messageId) : null);
  if (!attachment) return null;

  if (image) {
    return file.status === 'ready' ? (
      <img
        src={file.url}
        alt={attachment.name}
        className="mt-2 max-h-60 max-w-full rounded-lg border border-line object-contain"
      />
    ) : (
      <p className="mt-2 text-sm text-ink-muted">
        {file.status === 'error' ? 'The image is no longer available.' : 'Loading image…'}
      </p>
    );
  }

  const { name } = attachment;
  const download = async () => {
    try {
      saveBlob(await fetchFile(reportedAttachmentPath(item.messageId), true), name);
    } catch (error) {
      showToast(toApiError(error).message, 'error');
    }
  };

  return (
    <div className="mt-2 flex max-w-sm items-center gap-3 rounded-xl border border-line bg-paper-raised p-2.5">
      <FileText className="h-5 w-5 shrink-0 text-clay-600" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{attachment.name}</span>
        <span className="block text-xs text-ink-muted">{formatFileSize(attachment.size)}</span>
      </span>
      <button
        type="button"
        onClick={() => void download()}
        aria-label={`Download ${attachment.name}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-pine-700 hover:bg-pine-50"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

interface ReportCardProps {
  item: ReportedMessage;
  onDecide: (decision: ReportDecision) => Promise<void>;
}

export function ReportCard({ item, onDecide }: ReportCardProps) {
  const [busy, setBusy] = useState<ReportDecision | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const { conversation, message, reports } = item;
  const isGroup = conversation.type === 'group';

  async function decide(decision: ReportDecision) {
    setBusy(decision);
    await onDecide(decision);
    setBusy(null);
  }

  return (
    <li className="rounded-2xl border border-line bg-paper-raised p-4 shadow-bubble sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-ink-soft">
          {isGroup ? (
            <Users className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Lock className="h-4 w-4" aria-hidden="true" />
          )}
          {conversation.title}
        </span>
        <span className="text-ink-faint">
          {reports.length === 1 ? '1 report' : `${reports.length} reports`}
        </span>
      </div>

      <div className="mt-3 rounded-xl bg-paper-sunk/60 p-3">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold">{message.senderName}</span>
          {message.sender && <RoleBadge role={message.sender.role} />}
          {message.sender && <span className="text-ink-muted">{message.sender.email}</span>}
          <span className="text-xs text-ink-faint">· sent {formatRelative(message.sentAt)}</span>
          {message.isDeleted && (
            <span className="rounded-md bg-clay-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-clay-600">
              Deleted
            </span>
          )}
        </p>
        {message.text && (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] text-ink">
            {message.text}
          </p>
        )}
        <ReportedAttachment item={item} />
      </div>

      <ul className="mt-3 space-y-2">
        {reports.map((report) => (
          <li key={report.id} className="text-sm">
            <span className="rounded-md bg-marigold-100 px-1.5 py-0.5 text-xs font-semibold text-marigold-700">
              {REPORT_REASON_LABELS[report.reason]}
            </span>{' '}
            {report.note && <span className="text-ink-soft">“{report.note}” </span>}
            <span className="text-ink-muted">
              reported by {report.reportedBy?.name ?? 'a former user'}
              {report.reportedBy && ` (${report.reportedBy.email})`} ·{' '}
              {formatRelative(report.createdAt)}
            </span>
          </li>
        ))}
      </ul>

      {item.status === 'open' ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {isGroup && !message.isDeleted && (
            <Link
              to={`/chats/${conversation.id}?message=${item.messageId}`}
              className="inline-flex h-9 w-full items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-pine-700 hover:bg-pine-50 sm:mr-auto sm:w-auto"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open in group
            </Link>
          )}
          {confirmingRemoval ? (
            <>
              <span className="w-full text-sm text-ink-soft sm:w-auto">
                Delete this message for everyone?
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => setConfirmingRemoval(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1 sm:flex-none"
                loading={busy === 'remove-message'}
                onClick={() => void decide('remove-message')}
              >
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 sm:flex-none"
                loading={busy === 'dismiss'}
                onClick={() => void decide('dismiss')}
              >
                Dismiss
              </Button>
              {message.isDeleted ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  loading={busy === 'remove-message'}
                  onClick={() => void decide('remove-message')}
                >
                  Mark as removed
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => setConfirmingRemoval(true)}
                >
                  Delete message
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
          {item.status === 'actioned' ? 'Removed' : 'Dismissed'} by{' '}
          {item.reviewedBy?.name ?? 'an admin'}
          {item.reviewedAt && ` · ${formatRelative(item.reviewedAt)}`}
        </p>
      )}
    </li>
  );
}
