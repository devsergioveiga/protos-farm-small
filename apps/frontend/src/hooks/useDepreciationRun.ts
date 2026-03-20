import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { DepreciationRun, TriggerRunInput, DepreciationTrack } from '@/types/depreciation';

// ─── useDepreciationRun ───────────────────────────────────────────────────────

export function useDepreciationRun() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [lastRun, setLastRun] = useState<DepreciationRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerRun = useCallback(
    async (input: TriggerRunInput): Promise<DepreciationRun> => {
      if (!orgId) throw new Error('Organizacao nao identificada.');
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<DepreciationRun>(`/org/${orgId}/depreciation/run`, input);
        setLastRun(result);
        return result;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel executar a depreciacao. Verifique sua conexao e tente novamente.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const getLastRun = useCallback(
    async (
      periodYear: number,
      periodMonth: number,
      track?: DepreciationTrack,
    ): Promise<DepreciationRun | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          periodYear: String(periodYear),
          periodMonth: String(periodMonth),
        });
        if (track) params.set('track', track);
        const result = await api.get<DepreciationRun | null>(
          `/org/${orgId}/depreciation/last-run?${params.toString()}`,
        );
        setLastRun(result);
        return result;
      } catch {
        setError('Nao foi possivel carregar a ultima execucao.');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const refetch = useCallback(
    (periodYear: number, periodMonth: number, track?: DepreciationTrack) => {
      void getLastRun(periodYear, periodMonth, track);
    },
    [getLastRun],
  );

  return { lastRun, loading, error, triggerRun, getLastRun, refetch };
}
