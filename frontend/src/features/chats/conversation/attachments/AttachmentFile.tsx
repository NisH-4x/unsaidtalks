import { Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { Spinner } from '../../../../components/ui/Spinner';
import { Attachment, ChatMessage } from '../../../../types/message';
import { formatFileSize } from '../../../../utils/attachments';
import { downloadAttachment } from '../messageActions';

export function AttachmentFile({ message }: { message: ChatMessage & { attachment: Attachment } }) {
  const { attachment, upload, delivery } = message;
  const [downloading, setDownloading] = useState(false);
  const uploading = delivery === 'sending' && upload;
  const kind = attachment.mimeType === 'application/pdf' ? 'PDF' : 'File';

  async function handleDownload() {
    setDownloading(true);
    await downloadAttachment(message);
    setDownloading(false);
  }

  return (
    <div className="flex w-64 max-w-full items-center gap-3 rounded-xl border border-line bg-paper-raised/80 p-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-clay-50 text-clay-600">
        <FileText className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink" title={attachment.name}>
          {attachment.name}
        </span>
        <span className="block text-xs text-ink-muted">
          {uploading
            ? `Uploading ${Math.round(upload.progress * 100)}%`
            : `${kind} · ${formatFileSize(attachment.size)}`}
        </span>
        {uploading && (
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line">
            <span
              className="block h-full rounded-full bg-pine-500 transition-[width]"
              style={{ width: `${Math.round(upload.progress * 100)}%` }}
            />
          </span>
        )}
      </span>
      {!delivery && (
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={downloading}
          aria-label={`Download ${attachment.name}`}
          title="Download"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-pine-700 hover:bg-pine-50 disabled:opacity-60"
        >
          {downloading ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
