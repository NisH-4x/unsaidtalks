import { Lock } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getConversation } from '../../api/conversations.api';
import { toApiError } from '../../api/errors';
import { editMessage } from '../../api/messageTools.api';
import { LoadError } from '../../components/ui/LoadError';
import { Spinner } from '../../components/ui/Spinner';
import { useApiResource } from '../../hooks/useApiResource';
import { emitWithAck, socket } from '../../realtime/socket';
import { SocketEvent } from '../../realtime/socketEvents';
import { useTypingSignal } from '../../realtime/useTypingSignal';
import { useAuthStore } from '../../store/auth.store';
import { useChatsStore } from '../../store/chats.store';
import { useMessagesStore } from '../../store/messages.store';
import { usePresenceStore } from '../../store/presence.store';
import { useReceiptsStore } from '../../store/receipts.store';
import { showToast } from '../../store/toast.store';
import { ConversationDetails } from '../../types/conversation';
import { Message } from '../../types/message';
import { CurrentUser } from '../../types/user';
import { canAskDoubts, canPostAnnouncements, canResolveDoubts } from '../../utils/permissions';
import { ComposedMessage, Composer, ComposerMode } from './conversation/Composer';
import { ConversationHeader } from './conversation/ConversationHeader';
import { ConversationInfoPanel } from './conversation/ConversationInfoPanel';
import { DeleteMessageDialog } from './conversation/DeleteMessageDialog';
import { jumpToMessage } from './conversation/messageActions';
import { MessageList } from './conversation/MessageList';
import { MessageMenuContext } from './conversation/messageMenuItems';
import { PinnedBar } from './conversation/PinnedBar';
import { ReadReceiptsDialog } from './conversation/ReadReceiptsDialog';
import { ReportMessageDialog } from './conversation/ReportMessageDialog';
import { SearchPanel } from './conversation/search/SearchPanel';

function useConversationLifecycle(conversationId: string, details: ConversationDetails | null) {
  const setActiveConversation = useChatsStore((state) => state.setActiveConversation);
  const markRead = useChatsStore((state) => state.markRead);
  const openThread = useMessagesStore((state) => state.open);
  const rememberLastSeen = usePresenceStore((state) => state.rememberLastSeen);
  const setReadPositions = useReceiptsStore((state) => state.setMembers);

  useEffect(() => {
    setActiveConversation(conversationId);
    void openThread(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation, openThread]);

  useEffect(() => {
    if (!details) return;
    rememberLastSeen(details.members);
    setReadPositions(details.id, details.members);
  }, [details, rememberLastSeen, setReadPositions]);

  // Marked read only after the details (with the previous read position) have loaded,
  // and again whenever the tab comes back into view.
  const isMember = details?.access === 'member';
  useEffect(() => {
    if (!isMember) return;
    markRead(conversationId);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') markRead(conversationId);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isMember, conversationId, markRead]);

  // Admins viewing a group they are not in join its live updates explicitly,
  // and again after any reconnect.
  const isModerator = details?.access === 'moderator';
  useEffect(() => {
    if (!isModerator) return;
    const follow = () => void emitWithAck(SocketEvent.ConversationOpen, { conversationId });
    follow();
    socket.on('connect', follow);
    return () => {
      socket.off('connect', follow);
      void emitWithAck(SocketEvent.ConversationClose, { conversationId });
    };
  }, [isModerator, conversationId]);
}

const WIDE_SCREEN = '(min-width: 1024px)';

type SidePanel = 'info' | 'doubtSummary' | 'search' | null;

interface ConversationBodyProps {
  details: ConversationDetails;
  user: CurrentUser;
  panel: SidePanel;
  onClosePanel: () => void;
}

function ConversationBody({ details, user, panel, onClosePanel }: ConversationBodyProps) {
  const conversationId = details.id;
  const send = useMessagesStore((store) => store.send);
  const sendFile = useMessagesStore((store) => store.sendFile);
  const typing = useTypingSignal(conversationId);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const [reporting, setReporting] = useState<Message | null>(null);
  const [inspecting, setInspecting] = useState<Message | null>(null);
  // A reply to a message that has just been deleted would be refused, so it is dropped.
  const replyDeleted = useMessagesStore((store) =>
    Boolean(
      replyTo &&
      store.threads[conversationId]?.messages.some((m) => m.id === replyTo.id && m.isDeleted),
    ),
  );
  const activeReply = replyDeleted ? null : replyTo;
  const isGroup = details.type === 'group';

  const memberIds = useMemo(() => details.members.map((member) => member.id), [details.members]);
  const nameOf = useCallback(
    (userId: string) => details.members.find((member) => member.id === userId)?.name,
    [details.members],
  );
  const menu = useMemo<MessageMenuContext>(
    () => ({
      viewerId: user.id,
      viewerRole: user.role,
      conversationType: details.type,
      canReply: details.canSend,
      onReply: setReplyTo,
      onEdit: (message: Message) => {
        setReplyTo(null);
        setEditing(message);
      },
      onInfo: setInspecting,
      onDelete: setDeleting,
      onReport: setReporting,
    }),
    [user.id, user.role, details.type, details.canSend],
  );
  const composerMode: ComposerMode = canPostAnnouncements(user.role, details.type)
    ? 'announcement'
    : canAskDoubts(user.role, details.type)
      ? 'doubt'
      : null;

  // On phones a side panel covers the chat, so it closes to reveal the message.
  function openFromPanel(messageId: string) {
    if (!window.matchMedia(WIDE_SCREEN).matches) onClosePanel();
    void jumpToMessage(conversationId, messageId);
  }

  async function saveEdit(text: string) {
    if (!editing) return;
    try {
      useMessagesStore.getState().update(await editMessage(editing.id, text));
      setEditing(null);
    } catch (error) {
      showToast(toApiError(error).message, 'error');
    }
  }

  function handleSend({ file, ...composed }: ComposedMessage) {
    const sender = { id: user.id, name: user.name, role: user.role };
    if (file) void sendFile(conversationId, { ...composed, file, replyTo: activeReply }, sender);
    else void send(conversationId, { ...composed, replyTo: activeReply }, sender);
    setReplyTo(null);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {isGroup && <PinnedBar conversationId={conversationId} />}
        <MessageList
          conversationId={conversationId}
          currentUserId={user.id}
          isGroup={isGroup}
          lastReadMessageId={details.lastReadMessageId}
          menu={menu}
          nameOf={nameOf}
          memberIds={memberIds}
        />
        {details.canSend ? (
          <Composer
            key={editing?.id ?? 'new-message'}
            editing={editing}
            onSaveEdit={(text) => void saveEdit(text)}
            onCancelEdit={() => setEditing(null)}
            mode={composerMode}
            replyTo={activeReply}
            onCancelReply={() => setReplyTo(null)}
            onTyping={typing.typed}
            onStopTyping={typing.stop}
            onSend={handleSend}
          />
        ) : (
          <p
            role="status"
            className="flex shrink-0 items-center justify-center gap-2 border-t border-line bg-paper-raised px-4 py-4 text-center text-sm text-ink-muted"
          >
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            You can no longer send messages here because you no longer share a program group.
          </p>
        )}
      </div>
      {deleting && (
        <DeleteMessageDialog
          message={deleting}
          isOwn={deleting.sender?.id === user.id}
          onClose={() => setDeleting(null)}
        />
      )}
      {reporting && <ReportMessageDialog message={reporting} onClose={() => setReporting(null)} />}
      {inspecting && (
        <ReadReceiptsDialog
          message={inspecting}
          members={details.members}
          onClose={() => setInspecting(null)}
        />
      )}
      {(panel === 'info' || panel === 'doubtSummary') && (
        <ConversationInfoPanel
          key={panel}
          openAtDoubtSummary={panel === 'doubtSummary'}
          details={details}
          viewer={{ id: user.id, role: user.role }}
          nameOf={nameOf}
          onOpenMessage={openFromPanel}
          onClose={onClosePanel}
        />
      )}
      {panel === 'search' && (
        <SearchPanel
          conversationId={conversationId}
          onOpenMessage={openFromPanel}
          onClose={onClosePanel}
        />
      )}
    </div>
  );
}

function ConversationView({ conversationId, user }: { conversationId: string; user: CurrentUser }) {
  const load = useCallback(() => getConversation(conversationId), [conversationId]);
  const { state, reload } = useApiResource(load);
  const details = state.phase === 'ready' ? state.data : null;
  const [panel, setPanel] = useState<SidePanel>(null);
  const toggle = (next: Exclude<SidePanel, null>) =>
    setPanel((current) => (current === next ? null : next));

  useConversationLifecycle(conversationId, details);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ConversationHeader
        details={details}
        currentUserId={user.id}
        infoOpen={panel === 'info'}
        onToggleInfo={() => toggle('info')}
        searchOpen={panel === 'search'}
        onToggleSearch={() => toggle('search')}
        canSummariseDoubts={details?.type === 'group' && canResolveDoubts(user.role, 'group')}
        summaryOpen={panel === 'doubtSummary'}
        onToggleSummary={() => toggle('doubtSummary')}
      />

      {state.phase === 'loading' && (
        <div className="flex flex-1 items-center justify-center text-pine-600">
          <Spinner />
        </div>
      )}
      {state.phase === 'error' && (
        <div className="mx-auto w-full max-w-2xl p-4">
          <LoadError message={state.message} onRetry={reload} />
        </div>
      )}
      {details && (
        <ConversationBody
          details={details}
          user={user}
          panel={panel}
          onClosePanel={() => setPanel(null)}
        />
      )}
    </div>
  );
}

export function ConversationPage() {
  const { conversationId = '' } = useParams();
  const user = useAuthStore((state) => state.user);
  if (!user) return null;

  // Keyed so that switching conversations starts with fresh scroll and read state.
  return <ConversationView key={conversationId} conversationId={conversationId} user={user} />;
}
