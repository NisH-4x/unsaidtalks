import { useEffect } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useChatsStore } from '../../store/chats.store';
import { cn } from '../../utils/cn';
import { ChatList } from './ChatList';
import { ConnectionBanner } from './conversation/ConnectionBanner';

/**
 * Two panes on wider screens; on phones the list and the open conversation take turns
 * filling the screen, like WhatsApp.
 */
export function ChatsLayout() {
  const userId = useAuthStore((state) => state.user?.id);
  const load = useChatsStore((state) => state.load);
  const selectedId = useMatch('/chats/:conversationId')?.params.conversationId;

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  return (
    <div className="flex h-full flex-col">
      <ConnectionBanner />
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1">
        <aside
          className={cn(
            'w-full flex-col border-line md:flex md:w-[22rem] md:border-r lg:w-96',
            selectedId ? 'hidden' : 'flex',
          )}
        >
          <ChatList selectedId={selectedId} />
        </aside>
        <section className={cn('min-w-0 flex-1 md:flex', selectedId ? 'flex' : 'hidden')}>
          <Outlet />
        </section>
      </div>
    </div>
  );
}
