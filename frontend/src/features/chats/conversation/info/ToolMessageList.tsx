import { ReactNode, useState } from 'react';
import { Avatar } from '../../../../components/ui/Avatar';
import { Button } from '../../../../components/ui/Button';
import { LoadError } from '../../../../components/ui/LoadError';
import { RoleBadge } from '../../../../components/ui/RoleBadge';
import { Spinner } from '../../../../components/ui/Spinner';
import { useApiResource } from '../../../../hooks/useApiResource';
import { useConversationToolsStore } from '../../../../store/conversationTools.store';
import { Message } from '../../../../types/message';
import { messageSummary } from '../../../../utils/attachments';
import { formatRelative } from '../../../../utils/time';

export function ActionButton({ label, onRun }: { label: string; onRun: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await onRun();
    setBusy(false);
  }

  return (
    <Button size="sm" variant="ghost" loading={busy} onClick={() => void handleClick()}>
      {label}
    </Button>
  );
}

interface MessageCardProps {
  message: Message;
  onOpen: () => void;
  badge?: ReactNode;
  actions?: ReactNode;
}

function MessageCard({ message, onOpen, badge, actions }: MessageCardProps) {
  const { sender } = message;
  return (
    <li className="rounded-xl border border-line bg-paper-raised p-3 shadow-bubble">
      <div className="flex items-center gap-2.5">
        {sender && <Avatar name={sender.name} seed={sender.id} size="sm" />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">
              {sender?.name ?? 'Unknown sender'}
            </span>
            {sender && <RoleBadge role={sender.role} />}
          </p>
          <time dateTime={message.createdAt} className="block text-xs text-ink-faint">
            {formatRelative(message.createdAt)}
          </time>
        </div>
      </div>
      <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
        {messageSummary(message)}
      </p>
      {badge && <div className="mt-2">{badge}</div>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="secondary" onClick={onOpen}>
          Go to message
        </Button>
        {actions}
      </div>
    </li>
  );
}

interface ToolMessageListProps {
  load: () => Promise<Message[]>;
  emptyText: string;
  onOpenMessage: (messageId: string) => void;
  renderBadge?: (message: Message) => ReactNode;
  renderActions?: (message: Message) => ReactNode;
}

/** A list behind one of the group info tabs, refreshed whenever a pin, doubt or announcement changes. */
export function ToolMessageList({
  load,
  emptyText,
  onOpenMessage,
  renderBadge,
  renderActions,
}: ToolMessageListProps) {
  const revision = useConversationToolsStore((state) => state.revision);
  const { state, reload } = useApiResource(load, revision);

  if (state.phase === 'loading') {
    return (
      <div className="flex justify-center py-10 text-pine-600">
        <Spinner />
      </div>
    );
  }
  if (state.phase === 'error') return <LoadError message={state.message} onRetry={reload} />;
  if (state.data.length === 0) {
    return <p className="py-10 text-center text-sm leading-relaxed text-ink-muted">{emptyText}</p>;
  }

  return (
    <ul className="space-y-3">
      {state.data.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          onOpen={() => onOpenMessage(message.id)}
          badge={renderBadge?.(message)}
          actions={renderActions?.(message)}
        />
      ))}
    </ul>
  );
}
