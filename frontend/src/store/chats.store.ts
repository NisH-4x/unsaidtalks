import { create } from 'zustand';
import { listConversations } from '../api/conversations.api';
import { toApiError } from '../api/errors';
import { markConversationRead } from '../api/messages.api';
import { ChatListItem } from '../types/conversation';
import { Message, MessageCreatedPayload } from '../types/message';
import { messagePreview } from '../utils/attachments';

export const DELETED_MESSAGE_PREVIEW = 'This message was deleted';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ChatsState {
  status: LoadStatus;
  conversations: ChatListItem[];
  error: string | null;
  /** The user the list belongs to, so another account never sees a stale list. */
  ownerId: string | null;
  /** The conversation currently open on screen, if any. */
  activeConversationId: string | null;
  load: (ownerId: string) => Promise<void>;
  setActiveConversation: (conversationId: string | null) => void;
  applyIncomingMessage: (payload: MessageCreatedPayload, currentUserId: string) => void;
  /** A deleted message no longer shows its text as the chat's preview. */
  applyDeletedMessage: (message: Message) => void;
  /** An edited latest message updates the chat's preview. */
  applyEditedMessage: (message: Message) => void;
  markRead: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
  setUnread: (conversationId: string, unreadCount: number) => void;
  removeConversation: (conversationId: string) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as LoadStatus,
  conversations: [],
  error: null,
  ownerId: null,
  activeConversationId: null,
};

const READ_DEBOUNCE_MS = 400;
const pendingReads = new Map<string, number>();

function isOnScreen(state: ChatsState, conversationId: string): boolean {
  return state.activeConversationId === conversationId && document.visibilityState === 'visible';
}

export const useChatsStore = create<ChatsState>((set, get) => ({
  ...initialState,

  load: async (ownerId) => {
    const keepVisible = get().ownerId === ownerId && get().status === 'ready';
    set(keepVisible ? { ownerId } : { status: 'loading', error: null, ownerId, conversations: [] });

    try {
      const conversations = await listConversations();
      if (get().ownerId === ownerId) set({ status: 'ready', conversations, error: null });
    } catch (error) {
      if (get().ownerId === ownerId) set({ status: 'error', error: toApiError(error).message });
    }
  },

  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

  /** Moves the chat to the top with its new last message and, if unseen, one more unread. */
  applyIncomingMessage: ({ message, preview }, currentUserId) => {
    const state = get();
    const chat = state.conversations.find((c) => c.id === message.conversationId);
    if (!chat) {
      // Most likely someone just messaged this user privately for the first time. (An admin
      // following a group as moderator is skipped: that group is never in their list.)
      if (state.ownerId && state.activeConversationId !== message.conversationId) {
        void get().load(state.ownerId);
      }
      return;
    }

    const fromSomeoneElse = message.type !== 'system' && message.sender?.id !== currentUserId;
    const seenNow = isOnScreen(state, message.conversationId);
    // Two messages sent at almost the same moment can arrive in either order; the preview
    // always shows the later one (ids increase over time).
    const isLatest = !chat.lastMessage || message.id > chat.lastMessage.messageId;
    const updated: ChatListItem = {
      ...chat,
      ...(isLatest
        ? {
            lastMessage: {
              messageId: message.id,
              senderId: message.sender?.id ?? null,
              senderName: message.sender?.name ?? '',
              type: message.type,
              preview,
              sentAt: message.createdAt,
            },
            lastActivityAt: message.createdAt,
          }
        : {}),
      unreadCount: fromSomeoneElse && !seenNow ? chat.unreadCount + 1 : chat.unreadCount,
    };
    set({
      conversations: [updated, ...state.conversations.filter((c) => c.id !== chat.id)],
    });
    if (fromSomeoneElse && seenNow) get().markRead(chat.id);
  },

  applyDeletedMessage: (message) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.lastMessage?.messageId === message.id
          ? {
              ...c,
              lastMessage: { ...c.lastMessage, type: 'text', preview: DELETED_MESSAGE_PREVIEW },
            }
          : c,
      ),
    })),

  applyEditedMessage: (message) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.lastMessage?.messageId === message.id
          ? { ...c, lastMessage: { ...c.lastMessage, preview: messagePreview(message) } }
          : c,
      ),
    })),

  // Clears the badge at once; the server is told shortly after, so a burst of incoming
  // messages results in one request.
  markRead: (conversationId) => {
    get().clearUnread(conversationId);
    window.clearTimeout(pendingReads.get(conversationId));
    pendingReads.set(
      conversationId,
      window.setTimeout(() => {
        pendingReads.delete(conversationId);
        markConversationRead(conversationId).catch(() => undefined);
      }, READ_DEBOUNCE_MS),
    );
  },

  clearUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId && c.unreadCount > 0 ? { ...c, unreadCount: 0 } : c,
      ),
    })),

  setUnread: (conversationId, unreadCount) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount } : c,
      ),
    })),

  removeConversation: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
    })),

  reset: () => set(initialState),
}));
