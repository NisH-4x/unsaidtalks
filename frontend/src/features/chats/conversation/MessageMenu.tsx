import { ChevronDown } from 'lucide-react';
import { MouseEvent, useEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { REACTION_EMOJIS } from '../../../utils/reactions';
import { MenuItem } from './messageMenuItems';

interface MessageMenuProps {
  items: MenuItem[];
  align: 'start' | 'end';
  /** Quick reactions shown above the actions, when the viewer may react. */
  reactions?: { mine: string[]; onToggle: (emoji: string) => void };
}

/** Shown on hover with a mouse, and always visible on touch screens. */
export function MessageMenu({ items, align, reactions }: MessageMenuProps) {
  const [open, setOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

    const onPointerDown = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (items.length === 0 && !reactions) return null;

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    // Messages near the bottom of the screen open their menu upwards so it stays visible.
    setOpenUpwards(event.currentTarget.getBoundingClientRect().top > window.innerHeight / 2);
    setOpen((current) => !current);
  }

  return (
    <div ref={rootRef} className="relative shrink-0 self-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label="Message actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-opacity hover:bg-paper-sunk hover:text-ink focus-visible:opacity-100',
          open
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-70',
        )}
      >
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="menu"
          aria-label="Message actions"
          className={cn(
            'absolute z-20 min-w-[11.5rem] rounded-xl bg-paper-raised py-1 shadow-card ring-1 ring-line',
            align === 'end' ? 'right-0' : 'left-0',
            openUpwards ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {reactions && (
            <li role="none" className="flex gap-0.5 border-b border-line px-1.5 pb-1">
              {REACTION_EMOJIS.map((emoji) => {
                const mine = reactions.mine.includes(emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    aria-label={mine ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                    onClick={() => {
                      setOpen(false);
                      reactions.onToggle(emoji);
                    }}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-paper-sunk focus:bg-paper-sunk focus:outline-none',
                      mine && 'bg-pine-50 ring-1 ring-pine-300',
                    )}
                  >
                    {emoji}
                  </button>
                );
              })}
            </li>
          )}
          {items.map(({ label, icon: Icon, onSelect, tone }) => (
            <li key={label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-paper-sunk focus:bg-paper-sunk focus:outline-none',
                  tone === 'danger' ? 'text-clay-600' : 'text-ink-soft',
                )}
              >
                <Icon
                  className={cn('h-4 w-4', tone === 'danger' ? 'text-clay-600' : 'text-ink-muted')}
                  aria-hidden="true"
                />
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
