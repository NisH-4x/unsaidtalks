import { useEffect } from 'react';
import { Switch } from '../../components/ui/Switch';
import { useDesktopNotificationsStore } from '../../store/desktopNotifications.store';

const ALLOWED =
  'Shown while UnsaidTalks is open in the background. Message text is never included.';
const BLOCKED =
  'Notifications are blocked for this site. Allow them in your browser’s site settings first.';

export function DesktopNotificationsSetting() {
  const { enabled, permission, enable, disable, refresh } = useDesktopNotificationsStore();

  useEffect(() => refresh(), [refresh]);

  if (permission === 'unsupported') {
    return (
      <p className="border-b border-line px-4 py-3 text-xs text-ink-muted">
        This browser cannot show desktop notifications.
      </p>
    );
  }
  return (
    <div className="border-b border-line px-4 py-3">
      <Switch
        checked={enabled}
        onChange={(on) => (on ? void enable() : disable())}
        label="Desktop notifications"
        description={permission === 'denied' ? BLOCKED : ALLOWED}
        disabled={permission === 'denied'}
      />
    </div>
  );
}
