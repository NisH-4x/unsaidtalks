import { create } from 'zustand';
import {
  DesktopPermission,
  desktopPermission,
  readDesktopPreference,
  writeDesktopPreference,
} from '../utils/desktopNotifications';

interface DesktopNotificationsState {
  /** On only when the person turned it on here and the browser allows it. */
  enabled: boolean;
  permission: DesktopPermission;
  /** Asks the browser for permission; only ever called from the person's own click. */
  enable: () => Promise<void>;
  disable: () => void;
  /** Picks up a permission changed in the browser's site settings. */
  refresh: () => void;
}

const current = () => {
  const permission = desktopPermission();
  return { permission, enabled: permission === 'granted' && readDesktopPreference() };
};

export const useDesktopNotificationsStore = create<DesktopNotificationsState>((set) => ({
  ...current(),

  enable: async () => {
    let permission = desktopPermission();
    if (permission === 'default') permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    if (enabled) writeDesktopPreference(true);
    set({ permission, enabled });
  },

  disable: () => {
    writeDesktopPreference(false);
    set({ enabled: false });
  },

  refresh: () => set(current()),
}));
