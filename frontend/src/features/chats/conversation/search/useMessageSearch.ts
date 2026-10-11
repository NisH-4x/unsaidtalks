import { useEffect, useState } from 'react';
import { toApiError } from '../../../../api/errors';
import { searchMessages } from '../../../../api/messages.api';
import { Message } from '../../../../types/message';

export const MIN_SEARCH_LENGTH = 2;

interface SearchResult {
  query: string;
  messages: Message[];
  hasMore: boolean;
  error: string | null;
}

/**
 * Results for the current query. While a newer query is in flight the previous results are
 * not shown, so a slow response can never replace the results of a later search.
 */
export function useMessageSearch(conversationId: string, query: string) {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const active = query.length >= MIN_SEARCH_LENGTH;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    searchMessages(conversationId, query)
      .then((page) => {
        if (!cancelled) setResult({ query, ...page, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({ query, messages: [], hasMore: false, error: toApiError(error).message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, query, active, attempt]);

  const current = active && result?.query === query ? result : null;

  async function loadMore() {
    const oldest = current?.messages.at(-1);
    if (!current || !oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await searchMessages(conversationId, query, oldest.id);
      setResult((previous) =>
        previous?.query === query
          ? {
              ...previous,
              messages: [...previous.messages, ...page.messages],
              hasMore: page.hasMore,
            }
          : previous,
      );
    } catch {
      // The button stays, so the person can try again.
    } finally {
      setLoadingMore(false);
    }
  }

  function retry() {
    setResult(null);
    setAttempt((value) => value + 1);
  }

  return {
    status: !active ? 'idle' : !current ? 'loading' : current.error ? 'error' : 'ready',
    messages: current?.messages ?? [],
    hasMore: current?.hasMore ?? false,
    error: current?.error ?? null,
    loadingMore,
    loadMore,
    retry,
  } as const;
}
