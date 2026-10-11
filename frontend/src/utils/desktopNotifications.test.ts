import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppNotification } from '../types/notification';
import { claimNotification, needsDesktopNotification } from './desktopNotifications';

const reply: AppNotification = {
  id: 'n1',
  type: 'reply',
  conversation: { id: 'c1', type: 'group', name: 'TCS NQT Prep' },
  messageId: 'm1',
  actor: { id: 'u-priya', name: 'Priya Sharma', role: 'mentor' },
  preview: 'Yes, on the portal.',
  readAt: null,
  createdAt: '2026-10-11T10:00:00.000Z',
};

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe('needsDesktopNotification', () => {
  it('notifies only when the app is not in front of the person', () => {
    expect(needsDesktopNotification(reply, 'u-rahul', { hidden: true, focused: false })).toBe(true);
    expect(needsDesktopNotification(reply, 'u-rahul', { hidden: false, focused: false })).toBe(
      true,
    );
    expect(needsDesktopNotification(reply, 'u-rahul', { hidden: false, focused: true })).toBe(
      false,
    );
  });

  it('never notifies people about their own actions', () => {
    expect(needsDesktopNotification(reply, 'u-priya', { hidden: true, focused: false })).toBe(
      false,
    );
  });
});

describe('claimNotification', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lets only the first tab show a notification', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() });
    expect(claimNotification('n1')).toBe(true);
    expect(claimNotification('n1')).toBe(false);
    expect(claimNotification('n2')).toBe(true);
  });

  it('still shows notifications when storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(claimNotification('n1')).toBe(true);
  });
});

describe('desktop notifications setting', () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    vi.resetModules();
    storage = fakeStorage();
  });
  afterEach(() => vi.unstubAllGlobals());

  async function storeWithPermission(permission: string, answer: string) {
    const requestPermission = vi.fn(() => Promise.resolve(answer));
    vi.stubGlobal('Notification', { permission, requestPermission });
    vi.stubGlobal('window', { localStorage: storage, Notification: {} });
    const { useDesktopNotificationsStore } = await import('../store/desktopNotifications.store');
    return { store: useDesktopNotificationsStore, requestPermission };
  }

  it('asks for permission only when turned on, and remembers the choice', async () => {
    const { store, requestPermission } = await storeWithPermission('default', 'granted');
    expect(store.getState().enabled).toBe(false);
    expect(requestPermission).not.toHaveBeenCalled();

    await store.getState().enable();

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ enabled: true, permission: 'granted' });
    expect(storage.getItem('unsaidtalks.desktopNotifications')).toBe('on');

    store.getState().disable();
    expect(store.getState().enabled).toBe(false);
    expect(storage.getItem('unsaidtalks.desktopNotifications')).toBe('off');
  });

  it('stays off when the person blocks notifications', async () => {
    const { store } = await storeWithPermission('default', 'denied');
    await store.getState().enable();
    expect(store.getState()).toMatchObject({ enabled: false, permission: 'denied' });
  });
});
