import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshSession } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { useChatsStore } from '../store/chats.store';
import { useDesktopNotificationsStore } from '../store/desktopNotifications.store';
import { useConversationToolsStore } from '../store/conversationTools.store';
import { useMessagesStore } from '../store/messages.store';
import { useNotificationsStore } from '../store/notifications.store';
import { usePresenceStore } from '../store/presence.store';
import { useReceiptsStore } from '../store/receipts.store';
import { showToast } from '../store/toast.store';
import { Message, MessageCreatedPayload } from '../types/message';
import { AppNotification } from '../types/notification';
import {
  claimNotification,
  needsDesktopNotification,
  showDesktopNotification,
} from '../utils/desktopNotifications';
import { describeNotification, notificationLink } from '../utils/notificationText';
import { ConnectionStatus, emitWithAck, socket, useConnectionStore } from './socket';
import { PresenceUpdatePayload, SocketEvent, TypingPayload } from './socketEvents';

const MIN_REFRESH_INTERVAL_MS = 10_000;

/** Keeps the chat connection open while signed in and routes server events to the stores. */
export function useRealtime(): void {
  const userId = useAuthStore((state) => state.user?.id);
  // With BrowserRouter, `navigate` is a new function after every route change. Reading it
  // through a ref keeps the connection open across navigation instead of reconnecting
  // (and briefly missing messages) on every page change.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (!userId) return;

    const setStatus = (status: ConnectionStatus) => useConnectionStore.setState({ status });
    let connectedBefore = false;
    let lastRefreshAt = 0;

    // The server refused the handshake or ended the session: get a fresh access token
    // (or find out the session is over, which signs the user out) and try again once.
    const reauthenticate = async () => {
      if (Date.now() - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
        setStatus('offline');
        return;
      }
      lastRefreshAt = Date.now();
      setStatus('reconnecting');
      if (await refreshSession()) socket.connect();
      else setStatus('offline');
    };

    const syncPresence = async () => {
      const ack = await emitWithAck<{ online: string[] }>(SocketEvent.PresenceSync, {});
      if (ack.ok) usePresenceStore.getState().setOnline(ack.online);
    };

    const onConnect = () => {
      setStatus('connected');
      void syncPresence();
      if (connectedBefore) {
        const chats = useChatsStore.getState();
        const messages = useMessagesStore.getState();
        void chats.load(userId);
        void useNotificationsStore.getState().load();
        messages.keepOnly(chats.activeConversationId);
        if (chats.activeConversationId) {
          const tools = useConversationToolsStore.getState();
          void messages.catchUp(chats.activeConversationId);
          void tools.loadPins(chats.activeConversationId);
          tools.invalidate();
        }
      }
      connectedBefore = true;
    };

    const onDisconnect = (reason: string) => {
      if (reason === 'io server disconnect') void reauthenticate();
      else setStatus(socket.active ? 'reconnecting' : 'offline');
    };

    // While `socket.active` is true Socket.IO is retrying a network failure by itself.
    const onConnectError = () => {
      if (socket.active) setStatus('reconnecting');
      else void reauthenticate();
    };

    const onMessageNew = (payload: MessageCreatedPayload) => {
      const { message } = payload;
      useMessagesStore.getState().receive(message, payload.clientId);
      useChatsStore.getState().applyIncomingMessage(payload, userId);
      useConversationToolsStore.getState().noteNewMessage(message);
      if (message.sender) {
        // Sending a message means having read everything up to it, as on the server.
        useReceiptsStore.getState().apply(message.conversationId, message.sender.id, message.id);
        const { id, name } = message.sender;
        const { conversationId } = message;
        usePresenceStore
          .getState()
          .setTyping({ conversationId, userId: id, name, isTyping: false });
      }
    };

    const onMessageUpdated = ({ message }: { message: Message }) => {
      useMessagesStore.getState().update(message);
      useConversationToolsStore.getState().applyUpdate(message);
      const chats = useChatsStore.getState();
      if (message.isDeleted) chats.applyDeletedMessage(message);
      else if (message.editedAt) chats.applyEditedMessage(message);
    };

    const onReceiptUpdated = (receipt: {
      conversationId: string;
      userId: string;
      lastReadMessageId: string | null;
    }) =>
      useReceiptsStore
        .getState()
        .apply(receipt.conversationId, receipt.userId, receipt.lastReadMessageId);

    const onConversationHistory = ({ conversationId }: { conversationId: string }) =>
      void useMessagesStore.getState().reload(conversationId);

    const onConversationUnread = (update: { conversationId: string; unreadCount: number }) =>
      useChatsStore.getState().setUnread(update.conversationId, update.unreadCount);

    // A toast only for a conversation that is not on screen, and never while the tab is hidden
    // (it would expire unseen); the bell keeps the count either way.
    const onNotificationNew = (payload: { notification: AppNotification; unreadCount: number }) => {
      const { notification, unreadCount } = payload;
      useNotificationsStore.getState().receive(notification, unreadCount);
      const openIt = () => {
        void useNotificationsStore.getState().markRead([notification.id]);
        navigateRef.current(notificationLink(notification));
      };

      // Only while this tab is open: nothing here runs once the app is closed.
      const view = { hidden: document.visibilityState === 'hidden', focused: document.hasFocus() };
      if (
        useDesktopNotificationsStore.getState().enabled &&
        claimNotification(notification.id) &&
        needsDesktopNotification(notification, userId, view)
      ) {
        showDesktopNotification(notification, openIt);
      }

      const { activeConversationId } = useChatsStore.getState();
      const hidden = document.visibilityState === 'hidden';
      if (hidden || activeConversationId === notification.conversation.id) return;
      showToast(describeNotification(notification), 'info', { label: 'View', onClick: openIt });
    };

    const onNotificationsRead = (update: {
      unreadCount: number;
      ids?: string[];
      conversationId?: string;
    }) => useNotificationsStore.getState().applyRead(update);

    const onNotificationsRemoved = ({ ids, unreadCount }: { ids: string[]; unreadCount: number }) =>
      useNotificationsStore.getState().applyRemoved(ids, unreadCount);

    const onConversationRead = ({ conversationId }: { conversationId: string }) =>
      useChatsStore.getState().clearUnread(conversationId);

    const onConversationAdded = () => {
      void useChatsStore.getState().load(userId);
      void syncPresence();
    };

    const onPresenceUpdate = (update: PresenceUpdatePayload) => {
      if (update.userId !== userId) usePresenceStore.getState().applyUpdate(update);
    };

    const onTyping = (event: TypingPayload) => {
      if (event.userId !== userId) usePresenceStore.getState().setTyping(event);
    };

    const onConversationRemoved = ({ conversationId }: { conversationId: string }) => {
      const chats = useChatsStore.getState();
      chats.removeConversation(conversationId);
      useMessagesStore.getState().forget(conversationId);
      if (chats.activeConversationId === conversationId) {
        navigateRef.current('/', { replace: true });
      }
    };

    const listen = <T>(event: string, handler: (payload: T) => void) => {
      socket.on(event, handler);
      return () => {
        socket.off(event, handler);
      };
    };
    const stopListening = [
      listen('connect', onConnect),
      listen('disconnect', onDisconnect),
      listen('connect_error', onConnectError),
      listen(SocketEvent.MessageNew, onMessageNew),
      listen(SocketEvent.MessageUpdated, onMessageUpdated),
      listen(SocketEvent.ConversationRead, onConversationRead),
      listen(SocketEvent.ConversationUnread, onConversationUnread),
      listen(SocketEvent.ReceiptUpdated, onReceiptUpdated),
      listen(SocketEvent.ConversationHistory, onConversationHistory),
      listen(SocketEvent.ConversationAdded, onConversationAdded),
      listen(SocketEvent.ConversationRemoved, onConversationRemoved),
      listen(SocketEvent.PresenceUpdate, onPresenceUpdate),
      listen(SocketEvent.Typing, onTyping),
      listen(SocketEvent.NotificationNew, onNotificationNew),
      listen(SocketEvent.NotificationsRead, onNotificationsRead),
      listen(SocketEvent.NotificationsRemoved, onNotificationsRemoved),
    ];
    void useNotificationsStore.getState().load();
    setStatus('connecting');
    socket.connect();

    return () => {
      stopListening.forEach((stop) => stop());
      socket.disconnect();
      usePresenceStore.getState().reset();
      setStatus('offline');
    };
  }, [userId]);
}
