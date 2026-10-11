import { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

export function TextField({
  name,
  label,
  error,
  hint,
  trailing,
  id,
  className,
  ...rest
}: TextFieldProps) {
  const inputId = id ?? `field-${name}`;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-soft">
        {label}
      </label>
      <div className="relative">
        {/* 16px text stops iOS Safari from zooming into the field on focus. */}
        <input
          id={inputId}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            'h-12 w-full rounded-xl border bg-paper-raised px-3.5 text-base text-ink placeholder:text-ink-faint',
            'transition-colors focus:outline-none focus:ring-4',
            error
              ? 'border-clay-400 focus:border-clay-500 focus:ring-clay-100'
              : 'border-line-strong focus:border-pine-500 focus:ring-pine-100',
            trailing ? 'pr-12' : undefined,
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {message && (
        <p
          id={messageId}
          className={cn('mt-1.5 text-sm', error ? 'text-clay-600' : 'text-ink-muted')}
        >
          {message}
        </p>
      )}
    </div>
  );
}
