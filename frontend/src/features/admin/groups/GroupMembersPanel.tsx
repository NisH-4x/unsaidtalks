import { UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { addGroupMembers, removeGroupMember } from '../../../api/admin.api';
import { toApiError } from '../../../api/errors';
import { Alert } from '../../../components/ui/Alert';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { RoleBadge } from '../../../components/ui/RoleBadge';
import { AdminGroupDetails, AdminGroupMember } from '../../../types/conversation';
import { MemberPicker } from './MemberPicker';
import { useSelection } from './useSelection';

interface GroupMembersPanelProps {
  group: AdminGroupDetails;
  onChanged: (group: AdminGroupDetails) => void;
}

function MemberRow({
  member,
  busy,
  confirming,
  onAskRemove,
  onCancel,
  onRemove,
}: {
  member: AdminGroupMember;
  busy: boolean;
  confirming: boolean;
  onAskRemove: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar name={member.name} seed={member.id} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-medium">
          {member.name}
          {member.status !== 'active' && (
            <span className="rounded-md bg-clay-50 px-1.5 py-0.5 text-[11px] font-semibold text-clay-600">
              Deactivated
            </span>
          )}
        </p>
        <p className="truncate text-sm text-ink-muted">{member.email}</p>
      </div>
      <RoleBadge role={member.role} />
      {confirming ? (
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <span className="text-sm text-ink-soft">Remove?</span>
          <Button size="sm" variant="danger" loading={busy} onClick={onRemove}>
            Remove
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAskRemove}
          aria-label={`Remove ${member.name}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint hover:bg-clay-50 hover:text-clay-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export function GroupMembersPanel({ group, onChanged }: GroupMembersPanelProps) {
  const [picking, setPicking] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const { selected, toggle, clear } = useSelection();
  const memberIds = new Set(group.members.map((member) => member.id));

  async function run(action: () => Promise<AdminGroupDetails>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      onChanged(await action());
      setNotice({ tone: 'success', text: success });
      return true;
    } catch (caught) {
      setNotice({ tone: 'error', text: toApiError(caught).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addSelected() {
    const count = selected.size;
    const added = await run(
      () => addGroupMembers(group.id, [...selected.keys()]),
      `Added ${count} ${count === 1 ? 'person' : 'people'} to the group.`,
    );
    if (added) {
      clear();
      setPicking(false);
    }
  }

  async function remove(member: AdminGroupMember) {
    await run(
      () => removeGroupMember(group.id, member.id),
      `${member.name} was removed from the group.`,
    );
    setRemovingId(null);
  }

  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Members · {group.memberCount}</h2>
          <p className="text-sm text-ink-muted">
            {group.mentorCount} mentors · {group.menteeCount} mentees
          </p>
        </div>
        {!picking && (
          <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add people
          </Button>
        )}
      </div>

      {notice && (
        <Alert tone={notice.tone} className="mt-4">
          {notice.text}
        </Alert>
      )}

      {picking && (
        <div className="mt-4 rounded-xl border border-pine-200 bg-pine-50/50 p-4">
          <MemberPicker excludeIds={memberIds} selected={selected} onToggle={toggle} />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clear();
                setPicking(false);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={selected.size === 0} loading={busy} onClick={addSelected}>
              Add {selected.size || ''} {selected.size === 1 ? 'person' : 'people'}
            </Button>
          </div>
        </div>
      )}

      {group.members.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No members yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {group.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              busy={busy && removingId === member.id}
              confirming={removingId === member.id}
              onAskRemove={() => setRemovingId(member.id)}
              onCancel={() => setRemovingId(null)}
              onRemove={() => void remove(member)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
