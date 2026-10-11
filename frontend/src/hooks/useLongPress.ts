import { MouseEvent, TouchEvent, useEffect, useRef } from 'react';

const HOLD_MS = 450;
const MOVE_TOLERANCE_PX = 10;

/**
 * Touch and hold, the usual way to open a message's actions on a phone. Moving the finger
 * (scrolling) cancels it, and the touch that ends a hold does not also tap what is underneath.
 */
export function useLongPress(onLongPress: () => void) {
  const callbackRef = useRef(onLongPress);
  const timerRef = useRef<number | undefined>(undefined);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onLongPress;
  });
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function cancel() {
    window.clearTimeout(timerRef.current);
    originRef.current = null;
  }

  function fire() {
    cancel();
    firedRef.current = true;
    callbackRef.current();
  }

  return {
    onTouchStart(event: TouchEvent) {
      firedRef.current = false;
      cancel();
      if (event.touches.length !== 1) return;
      const { clientX, clientY } = event.touches[0];
      originRef.current = { x: clientX, y: clientY };
      timerRef.current = window.setTimeout(fire, HOLD_MS);
    },
    onTouchMove(event: TouchEvent) {
      const origin = originRef.current;
      if (!origin) return;
      const { clientX, clientY } = event.touches[0];
      if (Math.hypot(clientX - origin.x, clientY - origin.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onTouchEnd(event: TouchEvent) {
      cancel();
      if (firedRef.current) event.preventDefault();
    },
    onTouchCancel: cancel,
    // Android reports its own long press as a context menu; during a hold ours replaces it.
    // A right click with a mouse keeps the browser's menu.
    onContextMenu(event: MouseEvent) {
      if (!originRef.current && !firedRef.current) return;
      event.preventDefault();
      if (!firedRef.current) fire();
    },
  };
}
