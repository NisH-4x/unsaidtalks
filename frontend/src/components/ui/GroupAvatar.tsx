import { cn } from '../../utils/cn';

const SIZES = {
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

function groupInitials(name: string): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? ['#'];
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function GroupAvatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-2xl bg-pine-600 font-display font-semibold text-paper-raised',
        SIZES[size],
      )}
    >
      {groupInitials(name)}
    </span>
  );
}
