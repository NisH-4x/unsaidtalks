import { Dialog } from '../../../components/ui/Dialog';
import { Avatar } from '../../../components/ui/Avatar';
import { useReceiptsStore } from '../../../store/receipts.store';
import { ConversationMember } from '../../../types/conversation';
import { Message } from '../../../types/message';
import { messageSummary } from '../../../utils/attachments';
import { readStateOf } from '../../../utils/receipts';

interface ReadReceiptsDialogProps {
  message: Message;
  members: ConversationMember[];
  onClose: () => void;
}

function PeopleList({ title, people }: { title: string; people: ConversationMember[] }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {title} · {people.length}
      </h3>
      {people.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Nobody yet.</p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 py-2">
              <Avatar name={person.name} seed={person.id} size="sm" />
              <span className="text-sm">{person.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Who has read one of the viewer's group messages, kept up to date while open. */
export function ReadReceiptsDialog({ message, members, onClose }: ReadReceiptsDialogProps) {
  const positions = useReceiptsStore((state) => state.positions[message.conversationId]);
  const { readerIds, audienceIds } = readStateOf(
    message,
    members.map((member) => member.id),
    positions,
  );
  const byId = new Map(members.map((member) => [member.id, member]));
  const pick = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);

  return (
    <Dialog title="Message info" onClose={onClose}>
      <div className="space-y-5 overflow-y-auto p-4">
        <blockquote className="line-clamp-3 rounded-xl border-l-[3px] border-line-strong bg-paper-sunk/70 px-3 py-2 text-sm text-ink-muted">
          {messageSummary(message)}
        </blockquote>
        <PeopleList title="Read by" people={pick(readerIds)} />
        <PeopleList
          title="Not read yet"
          people={pick(audienceIds.filter((id) => !readerIds.includes(id)))}
        />
      </div>
    </Dialog>
  );
}
