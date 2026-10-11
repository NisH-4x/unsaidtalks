import { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-pine-600 text-paper-raised shadow-sm hover:bg-pine-700 active:bg-pine-800',
  secondary: 'border border-line-strong bg-paper-raised text-ink hover:bg-paper-sunk',
  danger: 'bg-clay-500 text-white shadow-sm hover:bg-clay-600 active:bg-clay-700',
  ghost: 'text-ink-soft hover:bg-paper-sunk hover:text-ink',
};

const SIZES: Record<Size, string> = {
  md: 'h-12 px-5 text-[15px]',
  sm: 'h-9 px-3.5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
