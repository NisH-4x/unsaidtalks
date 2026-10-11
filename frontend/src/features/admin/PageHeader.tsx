import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 pb-6 pt-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[2rem] font-medium leading-tight tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
