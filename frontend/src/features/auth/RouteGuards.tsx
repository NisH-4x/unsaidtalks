import { ShieldOff } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { UserRole } from '../../types/user';

export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status !== 'signed-in') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function GuestOnly() {
  const status = useAuthStore((state) => state.status);

  if (status === 'signed-in') return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Hides screens from other roles. The server enforces the same rule on every request. */
export function RequireRole({ role }: { role: UserRole }) {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== role) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <ShieldOff className="h-10 w-10 text-clay-500" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-medium">This page isn&apos;t for you</h1>
        <p className="mt-2 text-ink-muted">Only admins can open this section.</p>
        <Link to="/" className="mt-6 font-semibold text-pine-600 hover:text-pine-700">
          Back to chats
        </Link>
      </div>
    );
  }
  return <Outlet />;
}
