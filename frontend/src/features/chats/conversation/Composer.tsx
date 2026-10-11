import {
  Check,
  CircleQuestionMark,
  FileText,
  Megaphone,
  Paperclip,
  Pencil,
  Reply,
  SendHorizontal,
  X,
} from 'lucide-react';
import {
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { showToast } from '../../../store/toast.store';
import { Message } from '../../../types/message';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  attachmentProblem,
  formatFileSize,
  isImageType,
  messageSummary,
} from '../../../utils/attachments';
import { cn } from '../../../utils/cn';

const MAX_LENGTH = 4000;
const SHOW_COUNTER_FROM = 3600;
const MAX_HEIGHT_PX = 160;
// Kept short so it fits on one line beside the buttons on narrow phones.
const DEFAULT_PLACEHOLDER = 'Write a message…';

// On touch keyboards Enter adds a new line (like WhatsApp); the send button sends.
const enterSends = typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches;

/** The special kind of message this viewer may post here: mentors announce, mentees ask. */
export type ComposerMode = 'announcement' | 'doubt' | null;

export interface ComposedMessage {
  text: string;
  file: File | null;
  isAnnouncement: boolean;
  isDoubt: boolean;
}

interface ComposerProps {
  onSend: (message: ComposedMessage) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  mode: ComposerMode;
  replyTo: Message | null;
  onCancelReply: () => void;
  /** A message being edited. The parent remounts the composer when this changes. */
  editing: Message | null;
  onSaveEdit: (text: string) => void;
  onCancelEdit: () => void;
}

const MODES = {
  announcement: {
    icon: Megaphone,
    toggleLabel: 'Post as announcement',
    note: 'Posting as an announcement. It stands out for everyone and is listed under Announcements.',
    placeholder: 'Write an announcement…',
    activeClass: 'bg-marigold-100 text-marigold-700 ring-1 ring-marigold-300',
    noteClass: 'bg-marigold-50 text-marigold-700',
  },
  doubt: {
    icon: CircleQuestionMark,
    toggleLabel: 'Ask as doubt',
    note: 'Asking as a doubt. Mentors can find it under Doubts and mark it resolved.',
    placeholder: 'Describe your doubt…',
    activeClass: 'bg-clay-50 text-clay-600 ring-1 ring-clay-200',
    noteClass: 'bg-clay-50 text-clay-600',
  },
} as const;

function ReplyPreview({ message, onCancel }: { message: Message; onCancel: () => void }) {
  return (
    <div className="mx-auto mb-2 flex max-w-3xl items-start gap-2.5 rounded-xl border-l-[3px] border-pine-400 bg-paper-sunk/70 py-2 pl-3 pr-1.5">
      <Reply className="mt-0.5 h-4 w-4 shrink-0 text-pine-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-pine-700">
          Replying to {message.sender?.name ?? 'a message'}
        </p>
        <p className="truncate text-sm text-ink-muted">{messageSummary(message)}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-paper-sunk"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const thumbnail = useMemo(
    () => (isImageType(file.type) ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (thumbnail) URL.revokeObjectURL(thumbnail);
    },
    [thumbnail],
  );

  return (
    <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-xl border border-line bg-paper-sunk/70 py-2 pl-2 pr-1.5">
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-clay-50 text-clay-600">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
        <p className="text-xs text-ink-muted">
          {formatFileSize(file.size)} · add a caption or send
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-paper-sunk"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function EditPreview({ message, onCancel }: { message: Message; onCancel: () => void }) {
  return (
    <div className="mx-auto mb-2 flex max-w-3xl items-start gap-2.5 rounded-xl border-l-[3px] border-marigold-400 bg-marigold-50 py-2 pl-3 pr-1.5">
      <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-marigold-700" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-marigold-700">Editing message</p>
        <p className="truncate text-sm text-ink-muted">{messageSummary(message)}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel editing"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-marigold-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Composer({
  onSend,
  onTyping,
  onStopTyping,
  mode,
  replyTo,
  onCancelReply,
  editing,
  onSaveEdit,
  onCancelEdit,
}: ComposerProps) {
  const [text, setText] = useState(editing?.text ?? '');
  const [special, setSpecial] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trimmedText = text.trim();
  // An edit must change something, and a text message cannot become empty (a caption can).
  const canSend = editing
    ? trimmedText !== editing.text && (editing.type !== 'text' || trimmedText.length > 0)
    : trimmedText.length > 0 || file !== null;
  const modeConfig = mode ? MODES[mode] : null;
  const activeMode = special ? modeConfig : null;

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    const input = inputRef.current;
    if (!editing || !input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    fitHeight(input);
  }, [editing]);

  function fitHeight(element: HTMLTextAreaElement) {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }

  function attach(candidate: File) {
    const problem = attachmentProblem(candidate);
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    setFile(candidate);
    inputRef.current?.focus();
  }

  function submit() {
    const trimmed = text.trim();
    if (editing) {
      if (canSend) onSaveEdit(trimmed);
      return;
    }
    if (!trimmed && !file) return;
    onStopTyping();
    onSend({
      text: trimmed,
      file,
      isAnnouncement: special && mode === 'announcement',
      isDoubt: special && mode === 'doubt',
    });
    setText('');
    setFile(null);
    setSpecial(false);
    if (inputRef.current) {
      inputRef.current.style.height = '';
      inputRef.current.focus();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  // A screenshot pasted into the box becomes the attachment.
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.files[0];
    if (!pasted) return;
    event.preventDefault();
    attach(pasted);
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) attach(dropped);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape' && (editing || replyTo)) {
      if (editing) onCancelEdit();
      else onCancelReply();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && enterSends && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={handleDrop}
      className={cn(
        'shrink-0 border-t border-line bg-paper-raised px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] transition-colors sm:px-4',
        dragging && 'bg-pine-50 ring-2 ring-inset ring-pine-400',
      )}
    >
      {editing && <EditPreview message={editing} onCancel={onCancelEdit} />}
      {replyTo && !editing && <ReplyPreview message={replyTo} onCancel={onCancelReply} />}
      {file && <FilePreview file={file} onRemove={() => setFile(null)} />}
      {activeMode && (
        <p
          role="status"
          className={cn(
            'mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium',
            activeMode.noteClass,
          )}
        >
          <activeMode.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {activeMode.note}
        </p>
      )}

      <div className="mx-auto flex max-w-3xl items-end gap-1.5 sm:gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_ATTACHMENT_TYPES.join(',')}
          className="hidden"
          aria-label="Choose a file"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            // Cleared so that choosing the same file again still counts as a change.
            event.target.value = '';
            if (chosen) attach(chosen);
          }}
        />
        {!editing && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach an image or PDF"
            title="Attach an image or PDF (max 5 MB)"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-paper-sunk"
          >
            <Paperclip className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {modeConfig && !editing && (
          <button
            type="button"
            onClick={() => setSpecial((current) => !current)}
            aria-pressed={special}
            aria-label={modeConfig.toggleLabel}
            title={modeConfig.toggleLabel}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
              special ? modeConfig.activeClass : 'text-ink-muted hover:bg-paper-sunk',
            )}
          >
            <modeConfig.icon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {/* 16px text stops iOS Safari from zooming into the field on focus. */}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            fitHeight(event.target);
            if (editing) return;
            if (event.target.value.trim()) onTyping();
            else onStopTyping();
          }}
          onBlur={onStopTyping}
          onKeyDown={handleKeyDown}
          onPaste={editing ? undefined : handlePaste}
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder={file ? 'Add a caption…' : (activeMode?.placeholder ?? DEFAULT_PLACEHOLDER)}
          aria-label="Message"
          className="max-h-40 min-h-[2.75rem] min-w-0 flex-1 resize-none rounded-2xl border border-line bg-paper-sunk/60 px-4 py-2.5 text-base leading-snug text-ink placeholder:text-ink-faint focus:border-pine-400 focus:bg-paper-raised focus:outline-none focus:ring-4 focus:ring-pine-100"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={editing ? 'Save changes' : 'Send message'}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
            canSend
              ? 'bg-pine-600 text-paper-raised hover:bg-pine-700'
              : 'bg-paper-sunk text-ink-faint',
          )}
        >
          {editing ? (
            <Check className="h-5 w-5" aria-hidden="true" />
          ) : (
            <SendHorizontal className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
      {text.length >= SHOW_COUNTER_FROM && (
        <p className="mx-auto mt-1 max-w-3xl text-right text-xs text-ink-muted">
          {text.length}/{MAX_LENGTH}
        </p>
      )}
    </form>
  );
}
