import { Bell, CircleCheck, Megaphone, Reply, X } from 'lucide-react';
import { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { LoadError } from '../../components/ui/LoadError';
import { Spinner } from '../../components/ui/Spinner';
import { useNotificationsStore } from '../../store/notifications.store';
import { AppNotification, NotificationType } from '../../types/notification';
import { cn } from '../../utils/cn';
import { describeNotification, notificationLink } from '../../utils/notificationText';
import { formatRelative } from '../../utils/time';
import { DesktopNotificationsSetting } from './DesktopNotificationsSetting';

const TYPE_STYLES: Record<NotificationType, { icon: typeof Reply; className: string }> = {
  reply: { icon: Reply, className: 'bg-pine-50 text-pine-700' },
  announcement: { icon: Megaphone, className: 'bg-marigold-100 text-marigold-700' },
  doubt_resolved: { icon: CircleCheck, className: 'bg-pine-50 text-pine-700' },
};

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: () => void;
}) {
  const { icon: Icon, className } = TYPE_STYLES[notification.type];
  const unread = !notification.readAt;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-paper-sunk',
          unread && 'bg-pine-50/50',
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            className,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm text-ink', unread && 'font-semibold')}>
            {describeNotification(notification)}
          </span>
          {notification.preview && (
            <span className="mt-0.5 line-clamp-2 block text-sm text-ink-muted">
              {notification.preview}
            </span>
          )}
          <time dateTime={notification.createdAt} className="mt-1 block text-xs text-ink-faint">
            {formatRelative(notification.createdAt)}
          </time>
        </span>
        {unread && (
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-pine-600">
            <span className="sr-only">Unread</span>
          </span>
        )}
      </button>
    </li>
  );
}

/** Full screen on phones, a dropdown under the bell on larger screens. */
export const NotificationsPanel = forwardRef<HTMLDivElement, { onClose: () => void }>(
  function NotificationsPanel({ onClose }, ref) {
    const navigate = useNavigate();
    const { items, unreadCount, hasMore, status, error, loadingMore, load, loadMore, markRead } =
      useNotificationsStore();

    function open(notification: AppNotification) {
      if (!notification.readAt) void markRead([notification.id]);
      onClose();
      navigate(notificationLink(notification));
    }

    return createPortal(
      <div
        ref={ref}
        role="dialog"
        aria-label="Notifications"
        tabIndex={-1}
        className="fixed inset-0 z-40 flex flex-col bg-paper focus:outline-none sm:inset-auto sm:right-4 sm:top-[4.5rem] sm:max-h-[min(70vh,36rem)] sm:w-[24rem] sm:rounded-2xl sm:shadow-card sm:ring-1 sm:ring-line"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
          <h2 className="flex-1 font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markRead()}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-pine-700 hover:bg-pine-50"
            >
              Mark all as read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-paper-sunk"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <DesktopNotificationsSetting />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {status === 'loading' && (
            <div className="flex justify-center py-10 text-pine-600">
              <Spinner />
            </div>
          )}
          {status === 'error' && (
            <div className="p-4">
              <LoadError
                message={error ?? 'Could not load notifications.'}
                onRetry={() => void load()}
              />
            </div>
          )}
          {status === 'ready' && items.length === 0 && (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Bell className="h-8 w-8 text-ink-faint" aria-hidden="true" />
              <p className="mt-3 font-semibold">No notifications yet</p>
              <p className="mt-1 text-sm text-ink-muted">
                You will hear here about replies to your messages, announcements in your groups and
                answered doubts.
              </p>
            </div>
          )}
          {items.length > 0 && (
            <ul className="divide-y divide-line">
              {items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={() => open(notification)}
                />
              ))}
            </ul>
          )}
          {hasMore && (
            <div className="flex justify-center p-3">
              <Button
                variant="ghost"
                size="sm"
                loading={loadingMore}
                onClick={() => void loadMore()}
              >
                Show older
              </Button>
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  },
);
