import { FileText, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toApiError } from '../../../../api/errors';
import { importChat, previewImport } from '../../../../api/imports.api';
import { Alert } from '../../../../components/ui/Alert';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { Spinner } from '../../../../components/ui/Spinner';
import { ChatImportRecord, DateOrder, ImportPreview } from '../../../../types/chatImport';
import { cn } from '../../../../utils/cn';

interface ImportChatDialogProps {
  groupId: string;
  onImported: (record: ChatImportRecord) => void;
  onClose: () => void;
}

type Step =
  | { name: 'choose' }
  | { name: 'reading' }
  | { name: 'preview'; file: File; preview: ImportPreview; links: Record<string, string | null> }
  | { name: 'importing' }
  | { name: 'done'; record: ChatImportRecord };

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function PreviewStep({
  step,
  onChangeLink,
  onChangeDateOrder,
}: {
  step: Extract<Step, { name: 'preview' }>;
  onChangeLink: (sender: string, userId: string | null) => void;
  onChangeDateOrder: (order: DateOrder) => void;
}) {
  const { preview, links } = step;
  return (
    <div className="space-y-5">
      <p className="text-[15px] text-ink-soft">
        <strong>{preview.messageCount.toLocaleString('en-IN')} messages</strong> from{' '}
        {formatDate(preview.firstMessageAt)} to {formatDate(preview.lastMessageAt)} in{' '}
        <span className="break-all">{preview.fileName}</span>.
        {preview.skippedLines > 0 &&
          ` ${preview.skippedLines} notices and deleted messages will be left out.`}
      </p>

      {preview.alreadyImported && (
        <Alert tone="error">
          This file was already imported on {formatDate(preview.alreadyImported.importedAt)} (
          {preview.alreadyImported.importedCount} messages).
        </Alert>
      )}
      {!preview.alreadyImported && preview.duplicateCount > 0 && (
        <Alert tone="pending">
          {preview.duplicateCount} of these messages are already in the group from an earlier import
          and will be skipped.
        </Alert>
      )}

      {preview.dateOrderIsAmbiguous && (
        <fieldset>
          <legend className="text-sm font-semibold">How are dates written in this export?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
              [
                ['day-first', 'Day first (12/10 is 12 October)'],
                ['month-first', 'Month first (12/10 is 10 December)'],
              ] as const
            ).map(([order, label]) => (
              <label
                key={order}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                  preview.dateOrder === order ? 'border-pine-400 bg-pine-50' : 'border-line',
                )}
              >
                <input
                  type="radio"
                  name="dateOrder"
                  checked={preview.dateOrder === order}
                  onChange={() => onChangeDateOrder(order)}
                  className="accent-pine-600"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <section>
        <h3 className="text-sm font-semibold">Who wrote these messages?</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          Link a sender to a member only if it is the same person. Unlinked senders keep their
          WhatsApp name. Phone numbers are never shown.
        </p>
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {preview.senders.map((sender) => (
            <li key={sender.name} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{sender.name}</span>
                <span className="text-ink-muted"> · {sender.messageCount}</span>
              </span>
              <select
                aria-label={`Link ${sender.name} to a member`}
                value={links[sender.name] ?? ''}
                onChange={(event) => onChangeLink(sender.name, event.target.value || null)}
                className="h-9 rounded-lg border border-line bg-paper-raised px-2 text-sm"
              >
                <option value="">Keep the WhatsApp name</option>
                {preview.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>

      {preview.problemCount > 0 && (
        <section>
          <h3 className="text-sm font-semibold">
            {preview.problemCount} {preview.problemCount === 1 ? 'line' : 'lines'} could not be
            imported
          </h3>
          <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
            {preview.problems.map((problem) => (
              <li key={`${problem.line}-${problem.reason}`}>
                Line {problem.line}: {problem.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold">First messages</h3>
        <ul className="mt-1 space-y-1.5 text-sm">
          {preview.sample.map((message, index) => (
            <li key={index} className="rounded-lg bg-paper-sunk/70 px-3 py-2">
              <span className="font-medium">{message.sender}</span>
              <span className="text-xs text-ink-faint">
                {' '}
                · {new Date(message.sentAt).toLocaleString('en-IN')}
              </span>
              <span className="mt-0.5 line-clamp-2 block whitespace-pre-wrap text-ink-soft">
                {message.text}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Upload a WhatsApp export, check what was read and who is who, then import it. */
export function ImportChatDialog({ groupId, onImported, onClose }: ImportChatDialogProps) {
  const [step, setStep] = useState<Step>({ name: 'choose' });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function readFile(file: File, dateOrder?: DateOrder) {
    setError(null);
    setStep({ name: 'reading' });
    try {
      const preview = await previewImport(groupId, file, dateOrder);
      const links = Object.fromEntries(preview.senders.map((s) => [s.name, s.suggestedUserId]));
      setStep({ name: 'preview', file, preview, links });
    } catch (failure) {
      setError(toApiError(failure).message);
      setStep({ name: 'choose' });
    }
  }

  async function confirm(current: Extract<Step, { name: 'preview' }>) {
    setError(null);
    setStep({ name: 'importing' });
    try {
      const record = await importChat(
        groupId,
        current.file,
        current.preview.dateOrder,
        current.links,
      );
      onImported(record);
      setStep({ name: 'done', record });
    } catch (failure) {
      setError(toApiError(failure).message);
      setStep(current);
    }
  }

  const busy = step.name === 'reading' || step.name === 'importing';

  return (
    <Dialog title="Import a WhatsApp chat" onClose={onClose}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && <Alert tone="error">{error}</Alert>}

        {step.name === 'choose' && (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
              <li>In WhatsApp, open the group and choose More → Export chat.</li>
              <li>Choose “Without media”.</li>
              <li>Upload the .txt file here (up to 5 MB). Nothing is saved until you confirm.</li>
            </ol>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              aria-label="Exported chat file"
              className="hidden"
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                event.target.value = '';
                if (chosen) void readFile(chosen);
              }}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Choose the .txt file
            </Button>
          </div>
        )}

        {busy && (
          <p className="flex items-center gap-2 py-6 text-sm text-ink-muted">
            <Spinner className="h-4 w-4" />
            {step.name === 'reading' ? 'Reading the chat…' : 'Importing messages…'}
          </p>
        )}

        {step.name === 'preview' && (
          <PreviewStep
            step={step}
            onChangeLink={(sender, userId) =>
              setStep({ ...step, links: { ...step.links, [sender]: userId } })
            }
            onChangeDateOrder={(order) => void readFile(step.file, order)}
          />
        )}

        {step.name === 'done' && (
          <Alert tone="success" title="Chat imported">
            {step.record.importedCount} messages were added to the group
            {step.record.skippedCount > 0 &&
              `; ${step.record.skippedCount} were already there and were skipped`}
            .
          </Alert>
        )}
      </div>

      {step.name === 'preview' && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
          <Button variant="ghost" size="sm" onClick={() => setStep({ name: 'choose' })}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Choose another file
          </Button>
          <Button
            size="sm"
            disabled={Boolean(step.preview.alreadyImported)}
            onClick={() => void confirm(step)}
          >
            Import {step.preview.messageCount - step.preview.duplicateCount} messages
          </Button>
        </div>
      )}
      {step.name === 'done' && (
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Link
            to={`/chats/${groupId}`}
            className="inline-flex h-9 items-center rounded-xl bg-pine-600 px-3.5 text-sm font-semibold text-paper-raised hover:bg-pine-700"
          >
            Open the chat
          </Link>
        </div>
      )}
    </Dialog>
  );
}
