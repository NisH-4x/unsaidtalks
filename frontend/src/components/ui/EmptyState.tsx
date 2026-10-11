import { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon}
      <p className="mt-4 font-display text-xl font-medium">{title}</p>
      {children && (
        <div className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-muted">{children}</div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
