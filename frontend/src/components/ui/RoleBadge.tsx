import { UserRole } from '../../types/user';
import { cn } from '../../utils/cn';

const STYLES: Record<UserRole, string> = {
  admin: 'bg-ink text-paper-raised',
  mentor: 'bg-pine-600 text-paper-raised',
  mentee: 'bg-marigold-100 text-marigold-700',
};

const LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  mentor: 'Mentor',
  mentee: 'Mentee',
};

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em]',
        STYLES[role],
        className,
      )}
    >
      {LABELS[role]}
    </span>
  );
}
