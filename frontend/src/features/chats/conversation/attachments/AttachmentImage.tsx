import { Image as ImageIcon, ImageOff } from 'lucide-react';
import { attachmentPath } from '../../../../api/attachments.api';
import { useFileUrl } from '../../../../hooks/useFileUrl';
import { Attachment, ChatMessage } from '../../../../types/message';

const MAX_WIDTH_PX = 280;
const MAX_HEIGHT_PX = 320;
const DEFAULT_RATIO = 4 / 3;

/** Width-to-height ratio in the chat. Very tall or wide images are cropped; the viewer shows all of it. */
function displayRatio({ width, height }: Attachment): number {
  if (!width || !height) return DEFAULT_RATIO;
  return Math.min(Math.max(width / height, 0.5), 2.5);
}

function displayWidth(attachment: Attachment): number {
  return Math.round(Math.min(MAX_WIDTH_PX, MAX_HEIGHT_PX * displayRatio(attachment)));
}

interface AttachmentImageProps {
  message: ChatMessage & { attachment: Attachment };
  onOpen: (url: string) => void;
}

export function AttachmentImage({ message, onOpen }: AttachmentImageProps) {
  const { attachment, localUrl, upload, delivery } = message;
  const remote = useFileUrl(localUrl || delivery ? null : attachmentPath(message.id));
  const url = localUrl ?? (remote.status === 'ready' ? remote.url : null);
  const uploading = delivery === 'sending' && upload;

  return (
    <button
      type="button"
      onClick={() => url && onOpen(url)}
      disabled={!url}
      aria-label={`Open image ${attachment.name}`}
      className="relative block max-w-full overflow-hidden rounded-xl bg-paper-sunk"
      style={{ width: displayWidth(attachment), aspectRatio: String(displayRatio(attachment)) }}
    >
      {url ? (
        <img src={url} alt={attachment.name} className="h-full w-full object-cover" />
      ) : remote.status === 'error' ? (
        <span className="flex h-full flex-col items-center justify-center gap-1.5 text-xs text-ink-muted">
          <ImageOff className="h-5 w-5" aria-hidden="true" />
          Image unavailable
        </span>
      ) : (
        <span className="flex h-full items-center justify-center text-ink-faint">
          <ImageIcon className="h-6 w-6 animate-pulse" aria-hidden="true" />
          <span className="sr-only">Loading image</span>
        </span>
      )}

      {uploading && (
        <span className="absolute inset-0 flex items-center justify-center bg-ink/30">
          <span className="rounded-full bg-ink/75 px-3 py-1.5 text-xs font-semibold text-paper-raised">
            Uploading {Math.round(upload.progress * 100)}%
          </span>
        </span>
      )}
    </button>
  );
}
