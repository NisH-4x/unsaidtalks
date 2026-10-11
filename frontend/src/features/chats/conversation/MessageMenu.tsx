import { ChevronDown } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../utils/cn';
import { REACTION_EMOJIS } from '../../../utils/reactions';
import { MenuItem } from './messageMenuItems';

// A dropdown beside a bubble has no room on a phone, so phones get a sheet from the bottom.
const SHEET_SCREEN = '(max-width: 639px)';

type Placement = 'sheet' | 'above' | 'below';

interface MessageMenuProps {
  items: MenuItem[];
  /** The trigger edge the dropdown lines up with, chosen so that it opens over the bubble. */
  align: 'start' | 'end';
  /** Quick reactions shown above the actions, when the viewer may react. */
  reactions?: { mine: string[]; onToggle: (emoji: string) => void };
  /** Who wrote the message and what it says, shown at the top of the sheet. */
  context: { name: string; text: string };
}

export interface MessageMenuHandle {
  open: () => void;
}

/** Shown on hover with a mouse, and always visible on touch screens. */
export const MessageMenu = forwardRef<MessageMenuHandle, MessageMenuProps>(function MessageMenu(
  { items, align, reactions, context },
  ref,
) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isSheet = placement === 'sheet';

  const open = useCallback(() => {
    if (window.matchMedia(SHEET_SCREEN).matches) {
      setPlacement('sheet');
      return;
    }
    // Messages near the bottom of the screen open their menu upwards so it stays visible.
    const top = triggerRef.current?.getBoundingClientRect().top ?? 0;
    setPlacement(top > window.innerHeight / 2 ? 'above' : 'below');
  }, []);
  useImperativeHandle(ref, () => ({ open }), [open]);

  useEffect(() => {
    if (!placement) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

    const onPointerDown = (event: Event) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setPlacement(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPlacement(null);
      triggerRef.current?.focus();
    };
    // The sheet closes from its backdrop's click instead, so the tap that closes it does not
    // also land on the message underneath.
    const closesOnPointerDown = placement !== 'sheet';
    if (closesOnPointerDown) {
      document.addEventListener('mousedown', onPointerDown);
      document.addEventListener('touchstart', onPointerDown);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      if (closesOnPointerDown) {
        document.removeEventListener('mousedown', onPointerDown);
        document.removeEventListener('touchstart', onPointerDown);
      }
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [placement]);

  if (items.length === 0 && !reactions) return null;

  function choose(action: () => void) {
    setPlacement(null);
    action();
  }

  const menu = (
    <ul role="menu" aria-label="Message actions" className={isSheet ? 'pb-1' : 'py-1'}>
      {reactions && (
        <li
          role="none"
          className={cn(
            'flex border-b border-line',
            isSheet ? 'justify-around px-3 pb-3 pt-1' : 'gap-0.5 px-1.5 pb-1',
          )}
        >
          {REACTION_EMOJIS.map((emoji) => {
            const mine = reactions.mine.includes(emoji);
            return (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                aria-label={mine ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                onClick={() => choose(() => reactions.onToggle(emoji))}
                className={cn(
                  'flex items-center justify-center transition-colors focus:outline-none focus-visible:bg-paper-sunk',
                  isSheet
                    ? 'h-12 w-12 rounded-full text-[1.75rem] active:scale-90 active:bg-paper-sunk'
                    : 'h-9 w-9 rounded-lg text-lg hover:bg-paper-sunk',
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
            onClick={() => choose(onSelect)}
            className={cn(
              'flex w-full items-center text-left hover:bg-paper-sunk focus:outline-none focus-visible:bg-paper-sunk',
              isSheet
                ? 'gap-4 px-5 py-3.5 text-[15px] active:bg-paper-sunk'
                : 'gap-2.5 px-3.5 py-2.5 text-sm',
              tone === 'danger' ? 'text-clay-600' : 'text-ink-soft',
            )}
          >
            <Icon
              className={cn(
                isSheet ? 'h-5 w-5' : 'h-4 w-4',
                tone === 'danger' ? 'text-clay-600' : 'text-ink-muted',
              )}
              aria-hidden="true"
            />
            {label}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={rootRef} className="relative shrink-0 self-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (placement ? setPlacement(null) : open())}
        aria-label="Message actions"
        aria-haspopup="menu"
        aria-expanded={placement !== null}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-opacity hover:bg-paper-sunk hover:text-ink focus-visible:opacity-100',
          placement
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-70',
        )}
      >
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>

      {placement && !isSheet && (
        <div
          ref={menuRef}
          className={cn(
            'absolute z-20 min-w-[11.5rem] rounded-xl bg-paper-raised shadow-card ring-1 ring-line',
            align === 'end' ? 'right-0' : 'left-0',
            placement === 'above' ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {menu}
        </div>
      )}

      {isSheet &&
        createPortal(
          <div className="fixed inset-0 z-40 flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-ink/40 motion-safe:animate-fade-in"
              onClick={() => setPlacement(null)}
              aria-hidden="true"
            />
            <div
              ref={menuRef}
              className="relative rounded-t-3xl bg-paper-raised pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-card motion-safe:animate-sheet-up"
            >
              <div
                className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong"
                aria-hidden="true"
              />
              <p className="mx-5 mb-2 mt-3 truncate text-sm text-ink-muted">
                <span className="font-semibold text-ink-soft">{context.name}:</span> {context.text}
              </p>
              {menu}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});
