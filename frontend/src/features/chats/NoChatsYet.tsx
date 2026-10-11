import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserRole } from '../../types/user';

const COPY: Record<UserRole, string> = {
  mentee:
    'Your program groups will appear here once the UnsaidTalks team adds you to a batch. You can then message your mentors directly.',
  mentor:
    "The batches you mentor will appear here once an admin adds you. You'll be able to post announcements, pin resources and resolve doubts.",
  admin:
    "Groups you're a member of and your direct chats appear here. Manage every group from Admin.",
};

function Illustration() {
  return (
    <svg viewBox="0 0 160 120" className="h-24 w-32" aria-hidden="true">
      <rect x="18" y="20" width="92" height="46" rx="16" fill="#DCEBE7" />
      <path d="M38 66 L34 82 L54 66 Z" fill="#DCEBE7" />
      <rect x="32" y="34" width="52" height="6" rx="3" fill="#8BBDB2" />
      <rect x="32" y="47" width="34" height="6" rx="3" fill="#B7D6CF" />
      <rect x="62" y="56" width="80" height="40" rx="14" fill="#FDF0D9" />
      <path d="M122 96 L128 110 L108 96 Z" fill="#FDF0D9" />
      <rect x="76" y="70" width="44" height="6" rx="3" fill="#F6C673" />
      <circle cx="132" cy="28" r="6" fill="#F2A93B" />
    </svg>
  );
}

export function NoChatsYet({ firstName, role }: { firstName: string; role: UserRole }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <Illustration />
      <h2 className="mt-5 font-display text-2xl font-medium tracking-tight">
        Hi {firstName}, no conversations yet
      </h2>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-ink-muted">{COPY[role]}</p>
      {role === 'admin' && (
        <Link
          to="/admin/groups"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line-strong bg-paper-raised px-4 py-3 text-sm font-semibold text-ink shadow-card hover:border-pine-300"
        >
          Manage program groups
          <ArrowRight className="h-4 w-4 text-pine-600" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
