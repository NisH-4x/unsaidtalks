import { cn } from '../utils/cn';

type Tone = 'ink' | 'paper';

interface LogoMarkProps {
  tone?: Tone;
  className?: string;
}

export function LogoMark({ tone = 'ink', className }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className ?? 'h-8 w-8'} aria-hidden="true">
      <path
        d="M4 7a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-7l-5 4v-4.4A5 5 0 0 1 4 13z"
        fill={tone === 'ink' ? '#1F5F55' : '#FFFDF9'}
      />
      <path
        d="M13 17a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4v4l-4.5-4H17a4 4 0 0 1-4-4z"
        fill="#F2A93B"
      />
    </svg>
  );
}

interface LogoProps {
  tone?: Tone;
  className?: string;
}

export function Logo({ tone = 'ink', className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark tone={tone} />
      <span
        className={cn(
          'font-display text-[1.35rem] font-semibold tracking-tight',
          tone === 'ink' ? 'text-ink' : 'text-paper-raised',
        )}
      >
        Unsaid<span className={tone === 'ink' ? 'text-pine-600' : 'text-marigold-300'}>Talks</span>
      </span>
    </span>
  );
}
