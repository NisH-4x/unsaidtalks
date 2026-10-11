import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNotificationsStore } from '../../store/notifications.store';
import { cn } from '../../utils/cn';
import { NotificationsPanel } from './NotificationsPanel';

export function NotificationBell() {
  const unreadCount = useNotificationsStore((state) => state.unreadCount);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onPointerDown = (event: Event) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        className={cn(
          'relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-paper-sunk',
          open ? 'bg-paper-sunk text-ink' : 'text-ink-muted',
        )}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-clay-500 px-1 text-[10.5px] font-semibold leading-none text-white ring-2 ring-paper-raised"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationsPanel ref={panelRef} onClose={() => setOpen(false)} />}
    </>
  );
}
