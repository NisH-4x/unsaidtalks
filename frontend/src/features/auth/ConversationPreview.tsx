import { CheckCheck, Megaphone, Pin } from 'lucide-react';
import { CSSProperties, ReactNode } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { RoleBadge } from '../../components/ui/RoleBadge';
import { UserRole } from '../../types/user';

function rise(order: number): CSSProperties {
  return { animationDelay: `${200 + order * 140}ms` };
}

interface BubbleProps {
  name: string;
  role: UserRole;
  time: string;
  order: number;
  children: ReactNode;
}

function Bubble({ name, role, time, order, children }: BubbleProps) {
  return (
    <div className="flex animate-rise-in items-end gap-2.5" style={rise(order)}>
      <Avatar name={name} size="sm" />
      <div className="max-w-[18rem] rounded-2xl rounded-bl-md bg-paper-raised px-3.5 py-2.5 shadow-bubble">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{name}</span>
          <RoleBadge role={role} />
        </div>
        {children}
        <p className="mt-1 text-right text-[11px] text-ink-faint">{time}</p>
      </div>
    </div>
  );
}

/** Illustrative snippet of a program group, shown beside the sign-in form. */
export function ConversationPreview() {
  return (
    <div aria-hidden="true" className="w-full max-w-sm select-none space-y-3">
      <div
        className="flex animate-rise-in items-center gap-2 rounded-xl bg-pine-900/40 px-3.5 py-2.5 text-[13px] text-pine-100 ring-1 ring-pine-100/10"
        style={rise(0)}
      >
        <Pin className="h-3.5 w-3.5 shrink-0 text-marigold-300" />
        <span className="truncate">Mock test every Saturday · 10:00 AM</span>
      </div>

      <div
        className="animate-rise-in rounded-2xl border-l-4 border-marigold-400 bg-marigold-50 px-3.5 py-3 shadow-bubble"
        style={rise(1)}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-marigold-700">
          <Megaphone className="h-3.5 w-3.5" />
          Announcement · Priya Sharma
        </div>
        <p className="text-sm leading-snug text-ink">
          Mock Test 1 results are out. Batch average: 62%. Solutions are pinned above.
        </p>
      </div>

      <Bubble name="Ishita Singh" role="mentee" time="7:42 PM" order={2}>
        <p className="text-sm leading-snug text-ink-soft">
          Why is the answer 14⅓ days and not 14.5?
        </p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-pine-50 px-2 py-0.5 text-[11px] font-semibold text-pine-700">
          <CheckCheck className="h-3 w-3" />
          Doubt resolved
        </span>
      </Bubble>

      <Bubble name="Priya Sharma" role="mentor" time="7:45 PM" order={3}>
        <div className="mb-1.5 rounded-lg border-l-2 border-pine-400 bg-pine-50 px-2 py-1 text-xs text-ink-muted">
          Why is the answer 14⅓ days…
        </div>
        <p className="text-sm leading-snug text-ink-soft">
          Day 15 is A&apos;s turn, and only ⅓ of a day&apos;s work is left.
        </p>
      </Bubble>
    </div>
  );
}
