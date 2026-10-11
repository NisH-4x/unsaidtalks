import { MessagesSquare } from 'lucide-react';

export function NoConversationSelected() {
  return (
    <div className="grain flex flex-1 flex-col items-center justify-center bg-paper-sunk/40 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paper-raised shadow-card">
        <MessagesSquare className="h-6 w-6 text-pine-600" aria-hidden="true" />
      </span>
      <p className="mt-4 font-display text-xl font-medium">Pick a conversation</p>
      <p className="mt-1 max-w-xs text-sm text-ink-muted">
        Choose a group or a direct chat from the list to open it here.
      </p>
    </div>
  );
}
