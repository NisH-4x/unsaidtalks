import { Check, GraduationCap, Users } from 'lucide-react';
import { SignupRole } from '../../types/user';
import { cn } from '../../utils/cn';

const OPTIONS: Array<{ role: SignupRole; title: string; description: string; icon: typeof Users }> =
  [
    {
      role: 'mentee',
      title: 'Mentee',
      description: "I'm preparing in an UnsaidTalks program.",
      icon: GraduationCap,
    },
    {
      role: 'mentor',
      title: 'Mentor',
      description: 'I guide students. Needs admin approval.',
      icon: Users,
    },
  ];

interface RoleChoiceProps {
  value: SignupRole;
  onChange: (role: SignupRole) => void;
}

export function RoleChoice({ value, onChange }: RoleChoiceProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">I am joining as</legend>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ role, title, description, icon: Icon }) => {
          const selected = value === role;
          return (
            <label
              key={role}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-xl border p-3.5 transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-marigold-400 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper',
                selected
                  ? 'border-pine-500 bg-pine-50'
                  : 'border-line-strong bg-paper-raised hover:border-pine-300',
              )}
            >
              <input
                type="radio"
                name="role"
                value={role}
                checked={selected}
                onChange={() => onChange(role)}
                className="sr-only"
              />
              <Icon
                className={cn('h-5 w-5', selected ? 'text-pine-600' : 'text-ink-muted')}
                aria-hidden="true"
              />
              <span className="mt-2 font-semibold text-ink">{title}</span>
              <span className="mt-0.5 text-[13px] leading-snug text-ink-muted">{description}</span>
              {selected && (
                <Check
                  className="absolute right-3 top-3 h-4 w-4 text-pine-600"
                  aria-hidden="true"
                />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
