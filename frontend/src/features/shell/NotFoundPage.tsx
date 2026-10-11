import { Link } from 'react-router-dom';
import { LogoMark } from '../../components/Logo';

export function NotFoundPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <LogoMark className="h-12 w-12" />
      <h1 className="mt-6 font-display text-3xl font-medium">Page not found</h1>
      <p className="mt-2 text-ink-muted">The link may be broken or the page may have moved.</p>
      <Link to="/" className="mt-6 font-semibold text-pine-600 hover:text-pine-700">
        Go to your chats
      </Link>
    </div>
  );
}
