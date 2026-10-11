import { cn } from '../../utils/cn';

const PALETTE = [
  'bg-pine-100 text-pine-800',
  'bg-marigold-100 text-marigold-700',
  'bg-clay-100 text-clay-700',
  'bg-pine-200 text-pine-900',
  'bg-marigold-200 text-marigold-700',
  'bg-paper-sunk text-ink-soft',
];

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

/** The same seed always maps to the same colour, so a person is recognisable across screens. */
function colourFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

interface AvatarProps {
  name: string;
  seed?: string;
  size?: keyof typeof SIZES;
  /** Shows a green dot; screens should also state the status in text for screen readers. */
  online?: boolean;
  className?: string;
}

export function Avatar({ name, seed, size = 'md', online = false, className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        SIZES[size],
        colourFor(seed ?? name),
        className,
      )}
    >
      {initials(name)}
      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-paper-raised" />
      )}
    </span>
  );
}
