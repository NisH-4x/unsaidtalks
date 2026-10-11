import { CircleAlert, CircleCheck, Hourglass } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '../../utils/cn';

type Tone = 'error' | 'pending' | 'success';

const TONES: Record<Tone, { container: string; icon: typeof CircleAlert }> = {
  error: { container: 'border-clay-200 bg-clay-50 text-clay-700', icon: CircleAlert },
  pending: { container: 'border-marigold-200 bg-marigold-50 text-marigold-700', icon: Hourglass },
  success: { container: 'border-pine-200 bg-pine-50 text-pine-800', icon: CircleCheck },
};

interface AlertProps {
  tone: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Alert({ tone, title, children, className }: AlertProps) {
  const { container, icon: Icon } = TONES[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', container, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
