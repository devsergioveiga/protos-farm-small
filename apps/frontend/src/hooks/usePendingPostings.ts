import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  PendingJournalPosting,
  PendingCounts,
  PendingPostingStatus,
  AutoPostingSourceType,
} from '@/types/auto-posting';

// ─── usePendingPostings ───────────────────────────────────────────────────────

export function usePendingPostings(filters?: {
  status?: PendingPostingStatus;
  sourceType?: AutoPostingSourceType;
}) {
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const [postings, setPostings] = useState<PendingJournalPosting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPostings = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.sourceType) params.set('sourceType', filters.sourceType);
      const qs = params.toString();
      const result = await api.get<PendingJournalPosting[]>(
        `/org/${orgId}/auto-posting/pending${qs ? `?${qs}` : ''}`,
      );
      setPostings(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar pendências');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, filters?.status, filters?.sourceType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchPostings();
  }, [fetchPostings]);

  return { postings, isLoading, error, refetch: fetchPostings };
}

// ─── usePendingCounts ─────────────────────────────────────────────────────────

export function usePendingCounts() {
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const [counts, setCounts] = useState<PendingCounts>({ error: 0, pending: 0 });

  const fetchCounts = useCallback(async () => {
    if (!orgId) return;
    try {
      const result = await api.get<PendingCounts>(`/org/${orgId}/auto-posting/pending/counts`);
      setCounts(result);
    } catch {
      /* silent — badge counts are non-critical */
    }
  }, [orgId]);

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  return { counts, refetch: fetchCounts };
}

// ─── usePendingActions ────────────────────────────────────────────────────────

export function usePendingActions() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const retryOne = useCallback(
    async (pendingId: string): Promise<PendingJournalPosting> => {
      if (!orgId) throw new Error('Organização não encontrada');
      return api.post<PendingJournalPosting>(
        `/org/${orgId}/auto-posting/pending/${pendingId}/retry`,
        {},
      );
    },
    [orgId],
  );

  const retryBatch = useCallback(
    async (filters?: {
      status?: string;
      sourceType?: string;
    }): Promise<{ succeeded: number; failed: number }> => {
      if (!orgId) throw new Error('Organização não encontrada');
      return api.post<{ succeeded: number; failed: number }>(
        `/org/${orgId}/auto-posting/pending/retry-batch`,
        filters ?? {},
      );
    },
    [orgId],
  );

  return { retryOne, retryBatch };
}
