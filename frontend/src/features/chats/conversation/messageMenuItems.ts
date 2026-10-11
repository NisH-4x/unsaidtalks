import {
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  Copy,
  Download,
  Flag,
  Info,
  LucideIcon,
  Pencil,
  Pin,
  PinOff,
  Reply,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { showToast } from '../../../store/toast.store';
import { ConversationType } from '../../../types/conversation';
import { ChatMessage, Message } from '../../../types/message';
import { UserRole } from '../../../types/user';
import {
  canAskDoubts,
  canDeleteMessage,
  canEditMessage,
  canPinMessages,
  canReportMessage,
  canResolveDoubts,
} from '../../../utils/permissions';
import { downloadAttachment, messageActions } from './messageActions';

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: 'danger';
}

export interface MessageMenuContext {
  viewerId: string;
  viewerRole: UserRole;
  conversationType: ConversationType;
  canReply: boolean;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onInfo: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReport: (message: Message) => void;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied');
  } catch {
    showToast('Could not copy the message', 'error');
  }
}

/** Only the actions the server will accept from this viewer are offered. */
export function menuItemsFor(
  message: ChatMessage,
  isOwn: boolean,
  context: MessageMenuContext,
): MenuItem[] {
  if (message.delivery || message.isDeleted || message.type === 'system') return [];
  const { viewerRole, conversationType, canReply, onReply } = context;

  const items: MenuItem[] = [];
  if (canReply) items.push({ label: 'Reply', icon: Reply, onSelect: () => onReply(message) });
  if (canReply && canEditMessage(message, isOwn)) {
    items.push({ label: 'Edit', icon: Pencil, onSelect: () => context.onEdit(message) });
  }
  if (message.text) {
    items.push({ label: 'Copy text', icon: Copy, onSelect: () => void copyText(message.text) });
  }
  if (message.attachment) {
    items.push({
      label: 'Download',
      icon: Download,
      onSelect: () => void downloadAttachment(message),
    });
  }

  if (canPinMessages(viewerRole, conversationType)) {
    items.push(
      message.pin
        ? { label: 'Unpin', icon: PinOff, onSelect: () => void messageActions.unpin(message) }
        : { label: 'Pin to top', icon: Pin, onSelect: () => void messageActions.pin(message) },
    );
  }

  const { doubt } = message;
  if (isOwn && canAskDoubts(viewerRole, conversationType)) {
    if (!doubt) {
      items.push({
        label: 'Mark as doubt',
        icon: CircleQuestionMark,
        onSelect: () => void messageActions.markDoubt(message),
      });
    } else if (doubt.status === 'open') {
      items.push({
        label: 'Remove doubt',
        icon: CircleX,
        onSelect: () => void messageActions.unmarkDoubt(message),
      });
    }
  }

  if (doubt && canResolveDoubts(viewerRole, conversationType)) {
    items.push(
      doubt.status === 'open'
        ? {
            label: 'Mark resolved',
            icon: CircleCheck,
            onSelect: () => void messageActions.resolveDoubt(message),
          }
        : {
            label: 'Reopen doubt',
            icon: RotateCcw,
            onSelect: () => void messageActions.reopenDoubt(message),
          },
    );
  }

  if (isOwn && conversationType === 'group') {
    items.push({ label: 'Message info', icon: Info, onSelect: () => context.onInfo(message) });
  }
  if (canReportMessage(viewerRole, isOwn)) {
    items.push({ label: 'Report', icon: Flag, onSelect: () => context.onReport(message) });
  }
  if (canDeleteMessage(viewerRole, conversationType, isOwn)) {
    items.push({
      label: 'Delete for everyone',
      icon: Trash2,
      tone: 'danger',
      onSelect: () => context.onDelete(message),
    });
  }

  return items;
}
