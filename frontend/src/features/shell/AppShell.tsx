import { LogOut, MessagesSquare, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth.api';
import { Logo, LogoMark } from '../../components/Logo';
import { Toaster } from '../../components/Toaster';
import { Avatar } from '../../components/ui/Avatar';
import { RoleBadge } from '../../components/ui/RoleBadge';
import { useRealtime } from '../../realtime/useRealtime';
import { useAuthStore } from '../../store/auth.store';
import { useChatsStore } from '../../store/chats.store';
import { useConversationToolsStore } from '../../store/conversationTools.store';
import { useMessagesStore } from '../../store/messages.store';
import { useNotificationsStore } from '../../store/notifications.store';
import { useReceiptsStore } from '../../store/receipts.store';
import { NotificationBell } from '../notifications/NotificationBell';
import { cn } from '../../utils/cn';

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'inline-flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold transition-colors sm:px-3',
    isActive ? 'bg-pine-50 text-pine-700' : 'text-ink-muted hover:bg-paper-sunk hover:text-ink',
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const resetChats = useChatsStore((state) => state.reset);
  const resetMessages = useMessagesStore((state) => state.reset);
  const resetTools = useConversationToolsStore((state) => state.reset);
  const resetNotifications = useNotificationsStore((state) => state.reset);
  const resetReceipts = useReceiptsStore((state) => state.reset);
  const isChatsSection = useMatch({ path: '/', end: true }) !== null;
  const inConversation = useMatch('/chats/:conversationId') !== null;
  const [signingOut, setSigningOut] = useState(false);

  useRealtime();

  if (!user) return null;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      clearSession();
      resetChats();
      resetMessages();
      resetTools();
      resetNotifications();
      resetReceipts();
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* On phones an open conversation shows its own header with a back button instead. */}
      <header
        className={cn(
          'z-20 shrink-0 border-b border-line bg-paper-raised/90 backdrop-blur',
          inConversation && 'hidden md:block',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <NavLink to="/" aria-label="UnsaidTalks home" className="mr-1 sm:mr-2">
            <Logo className="hidden sm:inline-flex" />
            <LogoMark className="h-8 w-8 sm:hidden" />
          </NavLink>

          <nav className="flex items-center gap-1" aria-label="Main">
            <NavLink
              to="/"
              className={() => navClass({ isActive: isChatsSection || inConversation })}
            >
              <MessagesSquare className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Chats</span>
            </NavLink>
            {user.role === 'admin' && (
              <NavLink to="/admin" className={navClass}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Admin</span>
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user.name}</p>
              <RoleBadge role={user.role} className="mt-1" />
            </div>
            <Avatar name={user.name} seed={user.id} />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-paper-sunk hover:text-clay-600 disabled:opacity-50"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
