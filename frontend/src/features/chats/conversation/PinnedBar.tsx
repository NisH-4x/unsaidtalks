import { Pin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useConversationToolsStore } from '../../../store/conversationTools.store';
import { Message } from '../../../types/message';
import { messageSummary } from '../../../utils/attachments';
import { cn } from '../../../utils/cn';
import { jumpToMessage } from './messageActions';

const NO_PINS: Message[] = [];

/** Shows one pinned message at a time; each tap opens it and moves on to the next. */
export function PinnedBar({ conversationId }: { conversationId: string }) {
  const pins = useConversationToolsStore((state) => state.pins[conversationId] ?? NO_PINS);
  const loadPins = useConversationToolsStore((state) => state.loadPins);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    void loadPins(conversationId);
  }, [conversationId, loadPins]);

  if (pins.length === 0) return null;
  const index = position % pins.length;
  const current = pins[index];

  function openCurrent() {
    void jumpToMessage(conversationId, current.id);
    setPosition(index + 1);
  }

  return (
    <button
      type="button"
      onClick={openCurrent}
      title="Go to the pinned message"
      className="flex w-full shrink-0 items-center gap-3 border-b border-line bg-paper-raised px-3 py-2 text-left transition-colors hover:bg-paper-sunk/60 sm:px-4"
    >
      {pins.length > 1 && (
        <span className="flex h-9 flex-col gap-0.5" aria-hidden="true">
          {pins.map((pin, i) => (
            <span
              key={pin.id}
              className={cn(
                'w-0.5 flex-1 rounded-full',
                i === index ? 'bg-marigold-500' : 'bg-line-strong',
              )}
            />
          ))}
        </span>
      )}
      <Pin className="h-4 w-4 shrink-0 text-marigold-600" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-marigold-700">
          {pins.length > 1 ? `Pinned message ${index + 1} of ${pins.length}` : 'Pinned message'}
        </span>
        <span className="block truncate text-sm text-ink-soft">
          {current.sender && <span className="font-medium">{current.sender.name}: </span>}
          {messageSummary(current)}
        </span>
      </span>
    </button>
  );
}
