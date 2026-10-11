import { ArrowLeft, Info, Search, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../components/ui/Avatar';
import { GroupAvatar } from '../../../components/ui/GroupAvatar';
import { usePresenceStore, useTypists } from '../../../store/presence.store';
import { ConversationDetails } from '../../../types/conversation';
import { cn } from '../../../utils/cn';
import { describeTyping } from '../../../utils/presenceText';
import { formatLastSeen } from '../../../utils/time';

interface ConversationHeaderProps {
  details: ConversationDetails | null;
  currentUserId: string;
  infoOpen: boolean;
  onToggleInfo: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  /** Mentors and admins in groups get a shortcut to the AI summary of open doubts. */
  canSummariseDoubts: boolean;
  summaryOpen: boolean;
  onToggleSummary: () => void;
}

function useStatusLine(details: ConversationDetails, currentUserId: string) {
  const onlineIds = usePresenceStore((state) => state.onlineIds);
  const lastSeenAt = usePresenceStore((state) => state.lastSeenAt);
  const typing = describeTyping(useTypists(details.id), details.type === 'group');
  if (typing) return { text: typing, highlight: true };

  if (details.type === 'direct') {
    const other = details.members.find((member) => member.id !== currentUserId);
    if (!other) return { text: 'Private chat', highlight: false };
    if (onlineIds[other.id]) return { text: 'online', highlight: true };
    const seen = lastSeenAt[other.id];
    if (seen) return { text: formatLastSeen(seen), highlight: false };
    return {
      text: `${other.role === 'mentor' ? 'Mentor' : 'Mentee'} · Private chat`,
      highlight: false,
    };
  }

  const onlineCount = details.members.filter(
    (member) => member.id !== currentUserId && onlineIds[member.id],
  ).length;
  const parts = [details.program, details.batch, `${details.members.length} members`];
  if (onlineCount > 0) parts.push(`${onlineCount} online`);
  if (details.access === 'moderator') parts.push('Viewing as admin');
  return { text: parts.filter(Boolean).join(' · '), highlight: false };
}

function HeaderIdentity({
  details,
  currentUserId,
}: {
  details: ConversationDetails;
  currentUserId: string;
}) {
  const other = details.members.find((member) => member.id !== currentUserId);
  const otherOnline = usePresenceStore((state) => Boolean(other && state.onlineIds[other.id]));
  const status = useStatusLine(details, currentUserId);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {details.type === 'group' ? (
        <GroupAvatar name={details.title} />
      ) : (
        <Avatar name={details.title} seed={other?.id} online={otherOnline} />
      )}
      <div className="min-w-0">
        <h1 className="truncate font-semibold leading-tight">{details.title}</h1>
        <p
          className={cn('truncate text-xs', status.highlight ? 'text-pine-600' : 'text-ink-muted')}
          aria-live="polite"
        >
          {status.text}
        </p>
      </div>
    </div>
  );
}

export function ConversationHeader({
  details,
  currentUserId,
  infoOpen,
  onToggleInfo,
  searchOpen,
  onToggleSearch,
  canSummariseDoubts,
  summaryOpen,
  onToggleSummary,
}: ConversationHeaderProps) {
  const isGroup = details?.type === 'group';

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-paper-raised px-2 sm:px-4">
      <Link
        to="/"
        aria-label="Back to chats"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-paper-sunk md:hidden"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>
      {details && <HeaderIdentity details={details} currentUserId={currentUserId} />}
      {details && canSummariseDoubts && (
        <button
          type="button"
          onClick={onToggleSummary}
          aria-label="AI summary of open doubts"
          aria-expanded={summaryOpen}
          title="AI summary of open doubts"
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-marigold-600 hover:bg-paper-sunk"
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      {details && (
        <button
          type="button"
          onClick={onToggleSearch}
          aria-label="Search messages"
          aria-expanded={searchOpen}
          title="Search messages"
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-paper-sunk',
            !canSummariseDoubts && 'ml-auto',
          )}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      {details && (
        <button
          type="button"
          onClick={onToggleInfo}
          aria-label={isGroup ? 'Group info' : 'Chat info'}
          aria-expanded={infoOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-paper-sunk"
        >
          <Info className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </header>
  );
}
