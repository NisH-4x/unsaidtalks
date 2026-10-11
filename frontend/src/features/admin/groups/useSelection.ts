import { useCallback, useState } from 'react';
import { AdminUser } from '../../../types/user';

/** Tracks people picked in the member picker, keyed by id. */
export function useSelection() {
  const [selected, setSelected] = useState<ReadonlyMap<string, AdminUser>>(new Map());

  const toggle = useCallback((user: AdminUser) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(user.id)) next.delete(user.id);
      else next.set(user.id, user);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Map()), []);

  return { selected, toggle, clear };
}
