import { attachmentPath, fetchFile } from '../../../api/attachments.api';
import { toApiError } from '../../../api/errors';
import {
  addReaction,
  markDoubt,
  removeReaction,
  pinMessage,
  setDoubtStatus,
  unmarkDoubt,
  unpinMessage,
} from '../../../api/messageTools.api';
import { useConversationToolsStore } from '../../../store/conversationTools.store';
import { useMessagesStore } from '../../../store/messages.store';
import { showToast } from '../../../store/toast.store';
import { Message } from '../../../types/message';
import { saveBlob } from '../../../utils/download';

// The change is shown straight away from the response; everyone else (and this user's
// other tabs) receive the same change over the socket.
const run =
  (action: (id: string) => Promise<Message>, successText: string) =>
  async (message: Message): Promise<void> => {
    try {
      const updated = await action(message.id);
      useMessagesStore.getState().update(updated);
      useConversationToolsStore.getState().applyUpdate(updated);
      showToast(successText, 'success');
    } catch (error) {
      showToast(toApiError(error).message, 'error');
    }
  };

export const messageActions = {
  pin: run(pinMessage, 'Message pinned'),
  unpin: run(unpinMessage, 'Message unpinned'),
  markDoubt: run(markDoubt, 'Marked as a doubt. Mentors will see it under Doubts.'),
  unmarkDoubt: run(unmarkDoubt, 'Doubt removed'),
  resolveDoubt: run((id) => setDoubtStatus(id, 'resolved'), 'Doubt marked as resolved'),
  reopenDoubt: run((id) => setDoubtStatus(id, 'open'), 'Doubt reopened'),
};

export async function toggleReaction(message: Message, emoji: string, mine: boolean) {
  try {
    const updated = await (mine ? removeReaction : addReaction)(message.id, emoji);
    useMessagesStore.getState().update(updated);
  } catch (error) {
    showToast(toApiError(error).message, 'error');
  }
}

export async function jumpToMessage(conversationId: string, messageId: string): Promise<void> {
  const found = await useMessagesStore.getState().jumpTo(conversationId, messageId);
  if (!found) showToast('That message is too far back in the history to open here.');
}

function attachmentError(error: unknown): string {
  const { status, message } = toApiError(error);
  return status === 404 ? 'This file is no longer available.' : message;
}

// The file is fetched with the access token (a plain link could not carry it), then
// handed to the browser as a download.
export async function downloadAttachment(message: Message): Promise<void> {
  if (!message.attachment) return;
  try {
    saveBlob(await fetchFile(attachmentPath(message.id), true), message.attachment.name);
  } catch (error) {
    showToast(attachmentError(error), 'error');
  }
}
