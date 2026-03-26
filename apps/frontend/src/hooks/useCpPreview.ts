import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { CpPreviewResponse } from '@/types/payroll-integration';

export function useCpPreview(runId: string | null) {
  const { user } = useAuth();
  const [data, setData] = useState<CpPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const refetch = useCallback(async () => {
    if (!orgId || !runId) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<CpPreviewResponse>(
        `/org/${orgId}/payroll-runs/${runId}/cp-preview`,
      );
      setData(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar a prévia. Verifique sua conexão e tente novamente.';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, runId]);

  useEffect(() => {
    if (runId) {
      refetch();
    } else {
      setData(null);
      setError(null);
    }
  }, [runId, refetch]);

  return { data, isLoading, error, refetch };
}
