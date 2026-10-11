import { Download, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChatMessage } from '../../../../types/message';
import { formatMessageTime } from '../../../../utils/time';
import { downloadAttachment } from '../messageActions';

interface ImageViewerProps {
  message: ChatMessage;
  url: string;
  onClose: () => void;
}

/** Full-screen view of an image. Escape, the close button or a tap outside the image closes it. */
export function ImageViewer({ message, url, onClose }: ImageViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const name = message.attachment?.name ?? 'Image';

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 z-50 flex flex-col bg-ink/[0.97] text-paper-raised"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{message.sender?.name}</p>
          <p className="truncate text-xs text-paper-raised/60">
            {name} · {formatMessageTime(message.createdAt)}
          </p>
        </div>
        {!message.delivery && (
          <button
            type="button"
            onClick={() => void downloadAttachment(message)}
            aria-label="Download image"
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-paper-raised/10"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image"
          className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-paper-raised/10"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-8" onClick={onClose}>
        <img
          src={url}
          alt={name}
          className="max-h-full max-w-full rounded-lg object-contain"
          onClick={(event) => event.stopPropagation()}
        />
      </div>

      {message.text && (
        <p className="mx-auto max-w-2xl shrink-0 whitespace-pre-wrap break-words px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-paper-raised/90">
          {message.text}
        </p>
      )}
    </div>,
    document.body,
  );
}
