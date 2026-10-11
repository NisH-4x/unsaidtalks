import { UserRole } from '../../types/user';
import { RoleBadge } from '../../components/ui/RoleBadge';

const DEMO_PASSWORD = 'Demo@1234';

const DEMO_ACCOUNTS: Array<{ name: string; email: string; role: UserRole }> = [
  { name: 'Priya', email: 'priya@demo.test', role: 'mentor' },
  { name: 'Rahul', email: 'rahul@demo.test', role: 'mentee' },
  { name: 'Ananya', email: 'admin@demo.test', role: 'admin' },
];

interface DemoAccountsProps {
  onPick: (email: string, password: string) => void;
}

/** Development-only shortcut for the seeded accounts; not included in production builds. */
export function DemoAccounts({ onPick }: DemoAccountsProps) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-line-strong p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
        Demo accounts
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onPick(account.email, DEMO_PASSWORD)}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink-soft hover:border-pine-300 hover:text-ink"
          >
            {account.name}
            <RoleBadge role={account.role} />
          </button>
        ))}
      </div>
    </div>
  );
}
