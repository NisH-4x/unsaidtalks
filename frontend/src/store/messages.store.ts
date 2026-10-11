import { create } from 'zustand';
import { uploadAttachment } from '../api/attachments.api';
import { toApiError } from '../api/errors';
import { fetchMessages } from '../api/messages.api';
import { emitWithAck } from '../realtime/socket';
import { SocketEvent } from '../realtime/socketEvents';
import { ChatMessage, Message } from '../types/message';
import { PublicUser } from '../types/user';
import { isImageType, messagePreview, messageSummary, readImageSize } from '../utils/attachments';

export interface Thread {
  messages: ChatMessage[];
  hasMore: boolean;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  loadingOlder: boolean;
}

export interface SendInput {
  text: string;
  replyTo?: Message | null;
  isAnnouncement?: boolean;
  isDoubt?: boolean;
}

export interface SendFileInput extends SendInput {
  file: File;
}

/** A message to scroll to and highlight (from a reply quote, a pin or a doubt). */
export interface JumpTarget {
  conversationId: string;
  messageId: string;
  nonce: number;
}

interface MessagesState {
  threads: Record<string, Thread>;
  jumpTarget: JumpTarget | null;
  open: (conversationId: string) => Promise<void>;
  loadOlder: (conversationId: string, limit?: number) => Promise<void>;
  catchUp: (conversationId: string) => Promise<void>;
  /** Replaces the loaded history with the newest page, after older messages were imported. */
  reload: (conversationId: string) => Promise<void>;
  receive: (message: Message, clientId?: string) => void;
  update: (message: Message) => void;
  send: (conversationId: string, input: SendInput, sender: PublicUser) => Promise<void>;
  sendFile: (conversationId: string, input: SendFileInput, sender: PublicUser) => Promise<void>;
  retry: (conversationId: string, clientId: string) => Promise<void>;
  discard: (conversationId: string, clientId: string) => void;
  /** Loads history back to the message, then targets it. False if it is too far back. */
  jumpTo: (conversationId: string, messageId: string) => Promise<boolean>;
  keepOnly: (conversationId: string | null) => void;
  forget: (conversationId: string) => void;
  reset: () => void;
}

const CATCH_UP_PAGE_LIMIT = 5;
/** The server's largest page, used for refreshing what is on screen and for long jumps. */
const LARGE_PAGE_SIZE = 100;
const REFRESH_PAGE_LIMIT = 5;
/** How far back a jump may load (pages of 100, so 2,000 messages) before giving up. */
const JUMP_PAGE_LIMIT = 20;
const REPLY_PREVIEW_LENGTH = 120;

const isDraft = (message: ChatMessage) => message.delivery !== undefined;

function newClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Adds what only this tab knows about a message: the draft's clientId and a local image copy. */
function withLocalState(
  message: Message,
  { clientId, localUrl }: Pick<ChatMessage, 'clientId' | 'localUrl'>,
): ChatMessage {
  return { ...message, ...(clientId ? { clientId } : {}), ...(localUrl ? { localUrl } : {}) };
}

/**
 * Adds stored messages in id order (ids increase over time), skipping ones already shown,
 * and keeps drafts at the bottom. A draft is dropped once its stored copy arrives; the copy
 * keeps the draft's local state so the bubble on screen is updated rather than re-created.
 */
function mergeStored(current: ChatMessage[], incoming: Message[], clientId?: string) {
  const draft = clientId ? current.find((m) => isDraft(m) && m.clientId === clientId) : undefined;
  const drafts = current.filter((m) => isDraft(m) && m !== draft);
  const stored = new Map(current.filter((m) => !isDraft(m)).map((m) => [m.id, m]));
  for (const message of incoming) {
    const known = stored.get(message.id) ?? draft;
    stored.set(
      message.id,
      withLocalState(message, { clientId: known?.clientId ?? clientId, localUrl: known?.localUrl }),
    );
  }

  const ordered = [...stored.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [...ordered, ...drafts];
}

function lastStoredId(thread: Thread): string | undefined {
  return thread.messages.filter((m) => !isDraft(m)).at(-1)?.id;
}

function newDraft(
  conversationId: string,
  { text, replyTo, isAnnouncement, isDoubt }: SendInput,
  sender: PublicUser,
): ChatMessage {
  const clientId = newClientId();
  return {
    id: `draft:${clientId}`,
    conversationId,
    type: 'text',
    text,
    sender,
    attachment: null,
    replyTo: replyTo
      ? {
          messageId: replyTo.id,
          senderName: replyTo.sender?.name ?? '',
          type: replyTo.type,
          preview: messageSummary(replyTo).slice(0, REPLY_PREVIEW_LENGTH),
          isDeleted: false,
        }
      : null,
    isAnnouncement: isAnnouncement ?? false,
    pin: null,
    doubt: isDoubt ? { status: 'open', resolvedBy: null, resolvedAt: null } : null,
    reactions: [],
    editedAt: null,
    importedFrom: null,
    isDeleted: false,
    removedByModerator: false,
    createdAt: new Date().toISOString(),
    clientId,
    delivery: 'sending',
  };
}

/** Frees the local image copies held by these messages. */
function releaseLocalCopies(messages: ChatMessage[]): void {
  for (const message of messages) {
    if (message.localUrl) URL.revokeObjectURL(message.localUrl);
  }
}

function uploadFailureReason(error: unknown): string {
  const { status, message } = toApiError(error);
  return status === 413 ? 'Files can be at most 5 MB.' : message;
}

export const useMessagesStore = create<MessagesState>((set, get) => {
  const updateThread = (conversationId: string, update: (thread: Thread) => Partial<Thread>) =>
    set((state) => {
      const thread = state.threads[conversationId];
      if (!thread) return state;
      return { threads: { ...state.threads, [conversationId]: { ...thread, ...update(thread) } } };
    });

  const updateDraft = (conversationId: string, clientId: string, changes: Partial<ChatMessage>) =>
    updateThread(conversationId, (thread) => ({
      messages: thread.messages.map((m) =>
        isDraft(m) && m.clientId === clientId ? { ...m, ...changes } : m,
      ),
    }));

  const addDraft = (draft: ChatMessage) =>
    updateThread(draft.conversationId, (thread) => ({ messages: [...thread.messages, draft] }));

  const deliver = async (draft: ChatMessage) => {
    const { conversationId, clientId = '' } = draft;
    const ack = await emitWithAck<{ message: Message }>(SocketEvent.MessageSend, {
      conversationId,
      text: draft.text,
      clientId,
      replyToId: draft.replyTo?.messageId,
      isAnnouncement: draft.isAnnouncement || undefined,
      isDoubt: draft.doubt ? true : undefined,
    });
    if (ack.ok) {
      get().receive(ack.message, clientId);
    } else {
      updateDraft(conversationId, clientId, { delivery: 'failed', failureReason: ack.error });
    }
  };

  // Files go over HTTP (with upload progress); the stored message then reaches everyone,
  // including this tab, over the socket like any other message.
  const deliverFile = async (draft: ChatMessage) => {
    const { conversationId, clientId = '', upload, attachment } = draft;
    if (!upload) return;
    try {
      const message = await uploadAttachment(
        conversationId,
        {
          file: upload.file,
          clientId,
          text: draft.text,
          replyToId: draft.replyTo?.messageId,
          isAnnouncement: draft.isAnnouncement,
          isDoubt: Boolean(draft.doubt),
          width: attachment?.width ?? undefined,
          height: attachment?.height ?? undefined,
        },
        (progress) => updateDraft(conversationId, clientId, { upload: { ...upload, progress } }),
      );
      get().receive(message, clientId);
    } catch (error) {
      updateDraft(conversationId, clientId, {
        delivery: 'failed',
        failureReason: uploadFailureReason(error),
      });
    }
  };

  const fetchMissed = async (conversationId: string) => {
    for (let page = 0; page < CATCH_UP_PAGE_LIMIT; page += 1) {
      const thread = get().threads[conversationId];
      const after = thread && lastStoredId(thread);
      if (!thread || thread.status !== 'ready' || !after) return;

      const missed = await fetchMessages(conversationId, { after });
      updateThread(conversationId, (current) => ({
        messages: mergeStored(current.messages, missed.messages),
      }));
      if (!missed.hasMore) return;
    }
  };

  // Reloads the messages already on screen, newest first, back to the oldest one shown.
  const refreshShown = async (conversationId: string) => {
    const oldestShown = get().threads[conversationId]?.messages.find((m) => !isDraft(m))?.id;
    let before: string | undefined;
    for (let page = 0; oldestShown && page < REFRESH_PAGE_LIMIT; page += 1) {
      const fresh = await fetchMessages(conversationId, { before, limit: LARGE_PAGE_SIZE });
      updateThread(conversationId, (current) => ({
        messages: mergeStored(current.messages, fresh.messages),
      }));
      const oldestFresh = fresh.messages[0]?.id;
      if (!fresh.hasMore || !oldestFresh || oldestFresh <= oldestShown) return;
      before = oldestFresh;
    }
  };

  // Keeps loading older pages until the message is on screen, so a jump never leaves a
  // gap in the history.
  const loadUntil = async (conversationId: string, messageId: string) => {
    for (let page = 0; page <= JUMP_PAGE_LIMIT; page += 1) {
      const thread = get().threads[conversationId];
      if (!thread || thread.status !== 'ready') return false;
      if (thread.messages.some((m) => m.id === messageId)) return true;
      if (!thread.hasMore || page === JUMP_PAGE_LIMIT) return false;
      if (thread.loadingOlder) await new Promise((resolve) => setTimeout(resolve, 150));
      else await get().loadOlder(conversationId, LARGE_PAGE_SIZE);
    }
    return false;
  };

  return {
    threads: {},
    jumpTarget: null,

    open: async (conversationId) => {
      const status = get().threads[conversationId]?.status;
      if (status === 'ready' || status === 'loading') return;

      set((state) => ({
        threads: {
          ...state.threads,
          [conversationId]: {
            messages: [],
            hasMore: false,
            status: 'loading',
            error: null,
            loadingOlder: false,
          },
        },
      }));
      try {
        const page = await fetchMessages(conversationId);
        updateThread(conversationId, (thread) => ({
          messages: mergeStored(thread.messages, page.messages),
          hasMore: page.hasMore,
          status: 'ready',
        }));
      } catch (error) {
        updateThread(conversationId, () => ({
          status: 'error',
          error: toApiError(error).message,
        }));
      }
    },

    loadOlder: async (conversationId, limit) => {
      const thread = get().threads[conversationId];
      const oldest = thread?.messages.find((m) => !isDraft(m));
      if (!thread || !oldest || !thread.hasMore || thread.loadingOlder) return;

      updateThread(conversationId, () => ({ loadingOlder: true }));
      try {
        const page = await fetchMessages(conversationId, { before: oldest.id, limit });
        updateThread(conversationId, (current) => ({
          messages: mergeStored(current.messages, page.messages),
          hasMore: page.hasMore,
          loadingOlder: false,
        }));
      } catch {
        updateThread(conversationId, () => ({ loadingOlder: false }));
      }
    },

    // After a reconnect: fetch whatever arrived while this tab was offline, then reload the
    // messages already on screen, which may have been deleted, pinned or answered meanwhile.
    catchUp: async (conversationId) => {
      try {
        await fetchMissed(conversationId);
        await refreshShown(conversationId);
      } catch {
        // The next reconnect or reopening the conversation tries again.
      }
    },

    reload: async (conversationId) => {
      if (get().threads[conversationId]?.status !== 'ready') return;
      try {
        const page = await fetchMessages(conversationId);
        updateThread(conversationId, (thread) => ({
          messages: mergeStored(
            thread.messages.filter((m) => isDraft(m)),
            page.messages,
          ),
          hasMore: page.hasMore,
        }));
      } catch {
        // Reopening the conversation loads it again.
      }
    },

    receive: (message, clientId) =>
      updateThread(message.conversationId, (thread) => ({
        messages: mergeStored(thread.messages, [message], clientId),
      })),

    /**
     * Applies a change to a stored message (edit, pin, doubt status or deletion), keeping its
     * local state. Quotes of it in replies follow an edit and disappear after a deletion.
     */
    update: (message) => {
      const current = get().threads[message.conversationId]?.messages ?? [];
      if (message.isDeleted) releaseLocalCopies(current.filter((m) => m.id === message.id));

      updateThread(message.conversationId, (thread) => ({
        messages: thread.messages.map((m) => {
          if (m.id === message.id) {
            return message.isDeleted
              ? withLocalState(message, { clientId: m.clientId })
              : withLocalState(message, m);
          }
          if (m.replyTo?.messageId === message.id && !m.replyTo.isDeleted) {
            return {
              ...m,
              replyTo: message.isDeleted
                ? { ...m.replyTo, isDeleted: true, preview: '' }
                : { ...m.replyTo, preview: messagePreview(message) },
            };
          }
          return m;
        }),
      }));
    },

    send: async (conversationId, input, sender) => {
      const draft = newDraft(conversationId, input, sender);
      addDraft(draft);
      await deliver(draft);
    },

    sendFile: async (conversationId, { file, ...input }, sender) => {
      const image = isImageType(file.type);
      const size = image ? await readImageSize(file) : null;
      const draft: ChatMessage = {
        ...newDraft(conversationId, input, sender),
        type: image ? 'image' : 'file',
        attachment: {
          name: file.name,
          mimeType: file.type,
          size: file.size,
          width: size?.width ?? null,
          height: size?.height ?? null,
        },
        upload: { file, progress: 0 },
        localUrl: image ? URL.createObjectURL(file) : undefined,
      };
      addDraft(draft);
      await deliverFile(draft);
    },

    // Reusing the same clientId lets the server recognise a retry and avoid a duplicate.
    retry: async (conversationId, clientId) => {
      const draft = get().threads[conversationId]?.messages.find(
        (m) => isDraft(m) && m.clientId === clientId,
      );
      if (!draft) return;
      const retrying = { ...draft, upload: draft.upload && { ...draft.upload, progress: 0 } };
      updateDraft(conversationId, clientId, {
        delivery: 'sending',
        failureReason: undefined,
        upload: retrying.upload,
      });
      await (retrying.upload ? deliverFile(retrying) : deliver(retrying));
    },

    jumpTo: async (conversationId, messageId) => {
      const found = await loadUntil(conversationId, messageId);
      if (found) set({ jumpTarget: { conversationId, messageId, nonce: Date.now() } });
      return found;
    },

    discard: (conversationId, clientId) => {
      const isDiscarded = (m: ChatMessage) => isDraft(m) && m.clientId === clientId;
      releaseLocalCopies(get().threads[conversationId]?.messages.filter(isDiscarded) ?? []);
      updateThread(conversationId, (thread) => ({
        messages: thread.messages.filter((m) => !isDiscarded(m)),
      }));
    },

    keepOnly: (conversationId) => {
      const { threads } = get();
      for (const [id, thread] of Object.entries(threads)) {
        if (id !== conversationId) releaseLocalCopies(thread.messages);
      }
      const kept = conversationId ? threads[conversationId] : undefined;
      set({ threads: conversationId && kept ? { [conversationId]: kept } : {} });
    },

    forget: (conversationId) => {
      const { [conversationId]: forgotten, ...threads } = get().threads;
      if (forgotten) releaseLocalCopies(forgotten.messages);
      set({ threads });
    },

    reset: () => {
      for (const thread of Object.values(get().threads)) releaseLocalCopies(thread.messages);
      set({ threads: {}, jumpTarget: null });
    },
  };
});
