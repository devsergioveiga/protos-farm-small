import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';

// ─── useCheckAlertCount ──────────────────────────────────────────────
// Fetches the count of checks in A_COMPENSAR or DEVOLVIDO status
// Used by Sidebar to show a badge next to the Cheques nav item.

export function useCheckAlertCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ count: number }>('/org/checks/alert-count');
      setCount(result?.count ?? 0);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  return { count, loading, refetch: fetchCount };
}
