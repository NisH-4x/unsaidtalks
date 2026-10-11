import { useEffect, useState } from 'react';
import { fetchFile } from '../api/attachments.api';

type FileUrl = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error' };

/**
 * Loads a stored file (an API path) with the access token and exposes it as a temporary
 * object URL, released when the component unmounts. Pass null to skip loading, for example
 * when the sender already has a local copy.
 */
export function useFileUrl(path: string | null): FileUrl {
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    fetchFile(path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ path, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ path, url: null });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!path || loaded?.path !== path) return { status: 'loading' };
  return loaded.url ? { status: 'ready', url: loaded.url } : { status: 'error' };
}
