import { Eye, Lock, MessageCircle, Users, X } from 'lucide-react';
import { useState } from 'react';
import { listDirectContacts } from '../../../api/directChats.api';
import { Alert } from '../../../components/ui/Alert';
import { Avatar } from '../../../components/ui/Avatar';
import { RoleBadge } from '../../../components/ui/RoleBadge';
import { Spinner } from '../../../components/ui/Spinner';
import { useApiResource } from '../../../hooks/useApiResource';
import { useConversationToolsStore } from '../../../store/conversationTools.store';
import { useIsOnline, usePresenceStore } from '../../../store/presence.store';
import { ConversationDetails, ConversationMember } from '../../../types/conversation';
import { UserRole } from '../../../types/user';
import { cn } from '../../../utils/cn';
import { formatLastSeen } from '../../../utils/time';
import { useStartChat } from '../useStartChat';
import { AnnouncementsTab, DoubtsTab, GroupToolTabProps, PinnedTab } from './info/GroupToolTabs';

const SECTIONS: Array<{ role: UserRole; title: string }> = [
  { role: 'mentor', title: 'Mentors' },
  { role: 'mentee', title: 'Mentees' },
  { role: 'admin', title: 'Admins' },
];

interface MemberRowProps {
  member: ConversationMember;
  isYou: boolean;
  /** Present only for people the viewer may message privately. */
  onMessage?: () => void;
  starting: boolean;
}

function MemberRow({ member, isYou, onMessage, starting }: MemberRowProps) {
  const online = useIsOnline(member.id);
  const lastSeenAt = usePresenceStore((state) => state.lastSeenAt[member.id]);
  const status = online ? 'online' : lastSeenAt ? formatLastSeen(lastSeenAt) : null;

  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={member.name} seed={member.id} size="sm" online={online && !isYou} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{member.name}</span>
          {isYou && <span className="text-sm text-ink-faint">(you)</span>}
          <RoleBadge role={member.role} />
        </span>
        {!isYou && status && (
          <span className={cn('block text-xs', online ? 'text-emerald-600' : 'text-ink-faint')}>
            {status}
          </span>
        )}
      </span>
      {onMessage && (
        <button
          type="button"
          onClick={onMessage}
          disabled={starting}
          aria-label={`Message ${member.name}`}
          title={`Message ${member.name}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-pine-700 hover:bg-pine-50 disabled:opacity-50"
        >
          {starting ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}
    </li>
  );
}

interface MemberSectionsProps {
  members: ConversationMember[];
  currentUserId: string;
  messageableIds?: ReadonlySet<string>;
}

function MemberSections({ members, currentUserId, messageableIds }: MemberSectionsProps) {
  const { start, startingWith, error } = useStartChat();

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}
      {SECTIONS.map(({ role, title }) => {
        const inRole = members.filter((member) => member.role === role);
        if (inRole.length === 0) return null;
        return (
          <section key={role}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
              {title} · {inRole.length}
            </h3>
            <ul className="mt-1 divide-y divide-line">
              {inRole.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isYou={member.id === currentUserId}
                  starting={startingWith === member.id}
                  onMessage={
                    messageableIds?.has(member.id) ? () => void start(member.id) : undefined
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** Group members, with a message button next to everyone the viewer may chat with privately. */
function GroupMemberSections(props: Omit<MemberSectionsProps, 'messageableIds'>) {
  const { state } = useApiResource(listDirectContacts);
  const messageableIds =
    state.phase === 'ready' ? new Set(state.data.map((contact) => contact.id)) : undefined;
  return <MemberSections {...props} messageableIds={messageableIds} />;
}

function InfoTab({
  details,
  currentUserId,
}: {
  details: ConversationDetails;
  currentUserId: string;
}) {
  const isGroup = details.type === 'group';

  return (
    <div className="space-y-5">
      {details.access === 'moderator' && (
        <p className="flex items-start gap-2 rounded-xl bg-marigold-50 px-3 py-2.5 text-sm text-marigold-700">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          You&apos;re viewing this group as an admin. You are not a member.
        </p>
      )}

      {isGroup ? (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <Users className="h-4 w-4" aria-hidden="true" />
            About this group
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {details.description || 'No description yet.'}
          </p>
        </section>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-pine-50 px-3 py-2.5 text-sm text-pine-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Only the two of you can see this chat. Contact details stay private.
        </p>
      )}

      {isGroup ? (
        <GroupMemberSections members={details.members} currentUserId={currentUserId} />
      ) : (
        <MemberSections members={details.members} currentUserId={currentUserId} />
      )}
    </div>
  );
}

type PanelTab = 'info' | 'pinned' | 'doubts' | 'announcements';

const GROUP_TABS: Array<{ id: PanelTab; label: string }> = [
  { id: 'info', label: 'Info' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'doubts', label: 'Doubts' },
  { id: 'announcements', label: 'Announcements' },
];

const TAB_CONTENT: Record<Exclude<PanelTab, 'info'>, (props: GroupToolTabProps) => JSX.Element> = {
  pinned: PinnedTab,
  doubts: DoubtsTab,
  announcements: AnnouncementsTab,
};

interface ConversationInfoPanelProps {
  details: ConversationDetails;
  viewer: { id: string; role: UserRole };
  nameOf: (userId: string) => string | undefined;
  onOpenMessage: (messageId: string) => void;
  onClose: () => void;
  /** Opens on the Doubts tab and starts the AI summary (the header's shortcut). */
  openAtDoubtSummary?: boolean;
}

/** Full screen on phones, a side panel on wide screens. */
export function ConversationInfoPanel({
  details,
  viewer,
  nameOf,
  onOpenMessage,
  onClose,
  openAtDoubtSummary = false,
}: ConversationInfoPanelProps) {
  const isGroup = details.type === 'group';
  const [tab, setTab] = useState<PanelTab>(openAtDoubtSummary ? 'doubts' : 'info');
  // Only the first visit to the tab starts a summary; coming back to it later does not.
  const [startSummary, setStartSummary] = useState(openAtDoubtSummary);
  const pinCount = useConversationToolsStore((state) => state.pins[details.id]?.length ?? 0);
  const ToolTab = tab === 'info' ? null : TAB_CONTENT[tab];

  return (
    <aside
      aria-label={isGroup ? 'Group info' : 'Chat info'}
      className="fixed inset-0 z-30 flex flex-col bg-paper lg:static lg:z-auto lg:w-96 lg:shrink-0 lg:border-l lg:border-line"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-paper-raised px-4">
        <h2 className="font-semibold">{isGroup ? 'Group info' : 'Chat info'}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close info"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-paper-sunk"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {isGroup && (
        <div
          role="tablist"
          aria-label="Group details"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-paper-raised px-2"
        >
          {GROUP_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`info-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="info-tab-panel"
              onClick={() => {
                setTab(id);
                setStartSummary(false);
              }}
              className={cn(
                'relative h-11 shrink-0 px-3 text-sm font-semibold transition-colors',
                tab === id
                  ? 'text-pine-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-pine-600'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {label}
              {id === 'pinned' && pinCount > 0 && (
                <span className="ml-1.5 rounded-full bg-marigold-100 px-1.5 py-0.5 text-[11px] text-marigold-700">
                  {pinCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div
        id="info-tab-panel"
        role={isGroup ? 'tabpanel' : undefined}
        aria-labelledby={isGroup ? `info-tab-${tab}` : undefined}
        className="flex-1 overflow-y-auto p-4"
      >
        {ToolTab ? (
          <ToolTab
            conversationId={details.id}
            viewer={viewer}
            nameOf={nameOf}
            onOpenMessage={onOpenMessage}
            startSummary={startSummary}
          />
        ) : (
          <InfoTab details={details} currentUserId={viewer.id} />
        )}
      </div>
    </aside>
  );
}
