import { AppNotification } from '../types/notification';
import { describeNotification } from './notificationText';

export type DesktopPermission = 'unsupported' | 'default' | 'granted' | 'denied';

const PREFERENCE_KEY = 'unsaidtalks.desktopNotifications';
const SHOWN_KEY = 'unsaidtalks.desktopNotificationsShown';
const REMEMBERED_IDS = 50;

// Android browsers list the Notification API but only allow it from a service worker,
// which this app deliberately does not use, so they count as unsupported.
export function desktopPermission(): DesktopPermission {
  const available =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    !/Android/i.test(window.navigator?.userAgent ?? '');
  return available ? Notification.permission : 'unsupported';
}

// The preference lives in this browser only; storage can be unavailable (private windows).
export function readDesktopPreference(): boolean {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeDesktopPreference(on: boolean): void {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, on ? 'on' : 'off');
  } catch {
    // Without storage the setting lasts until the page is reloaded.
  }
}

/**
 * Desktop notifications are for when the person is not looking at the app: its tab is in the
 * background or minimised, or another window has focus. While they are looking (including at
 * the conversation concerned), the in-app toast and bell are enough.
 */
export function needsDesktopNotification(
  notification: AppNotification,
  viewerId: string,
  view: { hidden: boolean; focused: boolean },
): boolean {
  if (notification.actor?.id === viewerId) return false;
  return view.hidden || !view.focused;
}

/**
 * Every open tab receives the same socket event; the first one to record the notification
 * shows it. The shared tag also makes the browser replace rather than repeat a notification.
 */
export function claimNotification(id: string): boolean {
  try {
    const shown = JSON.parse(window.localStorage.getItem(SHOWN_KEY) ?? '[]') as string[];
    if (shown.includes(id)) return false;
    window.localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown, id].slice(-REMEMBERED_IDS)));
    return true;
  } catch {
    return true;
  }
}

/** Says who did what and where, but never the message itself, which may appear on a lock screen. */
export function showDesktopNotification(notification: AppNotification, onOpen: () => void): void {
  let shown: Notification;
  try {
    shown = new Notification(describeNotification(notification), {
      body: 'Open UnsaidTalks to read it.',
      icon: '/favicon.svg',
      tag: notification.id,
    });
  } catch {
    // Some browsers refuse page notifications; the in-app bell still has it.
    return;
  }
  shown.onclick = () => {
    window.focus();
    shown.close();
    onOpen();
  };
}
