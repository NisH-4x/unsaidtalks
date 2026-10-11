import { useState } from 'react';
import { toApiError } from '../../../api/errors';
import { deleteMessage } from '../../../api/messageTools.api';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { useMessagesStore } from '../../../store/messages.store';
import { showToast } from '../../../store/toast.store';
import { Message } from '../../../types/message';
import { messageSummary } from '../../../utils/attachments';

interface DeleteMessageDialogProps {
  message: Message;
  isOwn: boolean;
  onClose: () => void;
}

export function DeleteMessageDialog({ message, isOwn, onClose }: DeleteMessageDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setDeleting(true);
    setError(null);
    try {
      useMessagesStore.getState().update(await deleteMessage(message.id));
      showToast('Message deleted', 'success');
      onClose();
    } catch (failure) {
      setError(toApiError(failure).message);
      setDeleting(false);
    }
  }

  return (
    <Dialog title="Delete message?" onClose={onClose}>
      <div className="space-y-4 p-4">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          {isOwn
            ? 'It will be deleted for everyone in this chat. This cannot be undone.'
            : `You are removing ${message.sender?.name ?? 'this person'}'s message as a moderator. Everyone will see that it was removed.`}
        </p>
        <blockquote className="line-clamp-3 rounded-xl border-l-[3px] border-line-strong bg-paper-sunk/70 px-3 py-2 text-sm text-ink-muted">
          {messageSummary(message)}
        </blockquote>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" loading={deleting} onClick={() => void confirm()}>
          Delete for everyone
        </Button>
      </div>
    </Dialog>
  );
}
