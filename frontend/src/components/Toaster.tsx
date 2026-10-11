import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { ToastTone, useToastStore } from '../store/toast.store';
import { cn } from '../utils/cn';

const TONES: Record<ToastTone, { className: string; icon: typeof Info }> = {
  info: { className: 'bg-ink text-paper-raised', icon: Info },
  success: { className: 'bg-pine-700 text-paper-raised', icon: CircleCheck },
  error: { className: 'bg-clay-600 text-white', icon: CircleAlert },
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map(({ id, tone, text, action }) => {
        const { className, icon: Icon } = TONES[tone];
        return (
          <div
            key={id}
            role={tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex max-w-md animate-rise-in items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm shadow-card',
              className,
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{text}</span>
            {action && (
              <button
                type="button"
                onClick={() => {
                  dismiss(id);
                  action.onClick();
                }}
                className="ml-1 rounded-md px-2 py-0.5 text-sm font-semibold underline-offset-2 hover:underline"
              >
                {action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(id)}
              aria-label="Dismiss"
              className="ml-1 rounded p-0.5 opacity-70 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
