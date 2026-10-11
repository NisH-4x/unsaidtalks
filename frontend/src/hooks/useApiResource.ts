import { useCallback, useEffect, useState } from 'react';
import { toApiError } from '../api/errors';

export type ResourceState<T> =
  { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; data: T };

/**
 * Loads data when the component mounts or when `load` changes. Pass a stable function
 * (a module-level API call, or one wrapped in useCallback) to avoid refetching on every render.
 * Changing `refreshKey` refetches in the background, keeping the current data on screen.
 */
export function useApiResource<T>(load: () => Promise<T>, refreshKey?: unknown) {
  const [state, setState] = useState<ResourceState<T>>({ phase: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ phase: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ phase: 'error', message: toApiError(error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [load, version, refreshKey]);

  const reload = useCallback(() => {
    setState({ phase: 'loading' });
    setVersion((value) => value + 1);
  }, []);

  const setData = useCallback((data: T) => setState({ phase: 'ready', data }), []);

  return { state, reload, setData };
}
