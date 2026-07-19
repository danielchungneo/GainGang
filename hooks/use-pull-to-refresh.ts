import { useCallback, useRef, useState } from 'react';

/**
 * Drives a RefreshControl from user-initiated pulls only.
 *
 * Binding `refreshing` to react-query's `isRefetching` is buggy: background
 * refetches (stale queries, invalidations) toggle the native refresh control
 * while the screen may be off-screen, which on iOS leaves the spinner stuck
 * and the content offset shifted until the user manually pulls again.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchRef.current();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { isRefreshing, onRefresh };
}
