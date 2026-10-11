import { WifiOff } from 'lucide-react';
import { useConnectionStore } from '../../../realtime/socket';

export function ConnectionBanner() {
  const status = useConnectionStore((state) => state.status);
  if (status !== 'reconnecting' && status !== 'offline') return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 bg-marigold-100 px-4 py-2 text-sm text-marigold-700"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      {status === 'reconnecting'
        ? 'Reconnecting… new messages will appear when you are back online.'
        : 'You are offline. Messages will sync when the connection returns.'}
    </div>
  );
}
