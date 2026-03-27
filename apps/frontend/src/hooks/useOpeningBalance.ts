import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { OpeningBalanceLinePreview, PostOpeningBalanceInput, JournalEntry } from '@/types/journal-entries';

// ─── useOpeningBalancePreview ─────────────────────────────────────────────────

export function useOpeningBalancePreview(fiscalYearId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [lines, setLines] = useState<OpeningBalanceLinePreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    if (!orgId || !fiscalYearId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<OpeningBalanceLinePreview[]>(
        `/org/${orgId}/opening-balance/preview/${fiscalYearId}`,
      );
      setLines(result);
    } catch {
      setError('Não foi possível carregar a prévia do saldo de abertura.');
      setLines([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, fiscalYearId]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  return { lines, isLoading, error, refetch: fetchPreview };
}

// ─── usePostOpeningBalance ────────────────────────────────────────────────────

export function usePostOpeningBalance() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);

  const postOpeningBalance = useCallback(
    async (input: PostOpeningBalanceInput): Promise<JournalEntry> => {
      if (!orgId) throw new Error('Organização não encontrada');
      setIsLoading(true);
      try {
        return await api.post<JournalEntry>(`/org/${orgId}/opening-balance`, input);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { postOpeningBalance, isLoading };
}
