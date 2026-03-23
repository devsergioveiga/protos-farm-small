import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { LeasingOutput, CreateLeasingInput } from '@/types/asset';

// ─── State ────────────────────────────────────────────────────────────────────

interface UseAssetLeasingsState {
  leasings: LeasingOutput[];
  loading: boolean;
  error: string | null;
}

interface UseAssetLeasingsResult extends UseAssetLeasingsState {
  fetchLeasings: (farmId?: string, status?: string) => Promise<void>;
  createLeasing: (input: CreateLeasingInput) => Promise<void>;
  exercisePurchase: (id: string) => Promise<void>;
  returnAsset: (id: string) => Promise<void>;
  cancelLeasing: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAssetLeasings(): UseAssetLeasingsResult {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [state, setState] = useState<UseAssetLeasingsState>({
    leasings: [],
    loading: false,
    error: null,
  });

  // Keep last filters for refetch
  const [lastFarmId, setLastFarmId] = useState<string | undefined>();
  const [lastStatus, setLastStatus] = useState<string | undefined>();

  const fetchLeasings = useCallback(
    async (farmId?: string, status?: string) => {
      if (!orgId) return;
      setLastFarmId(farmId);
      setLastStatus(status);
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const qs = new URLSearchParams();
        if (farmId) qs.set('farmId', farmId);
        if (status) qs.set('status', status);

        const data = await api.get<LeasingOutput[]>(
          `/org/${orgId}/asset-leasings${qs.toString() ? `?${qs.toString()}` : ''}`,
        );

        setState({ leasings: data, loading: false, error: null });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Nao foi possivel carregar os contratos de leasing.';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [orgId],
  );

  const refetch = useCallback(async () => {
    await fetchLeasings(lastFarmId, lastStatus);
  }, [fetchLeasings, lastFarmId, lastStatus]);

  const createLeasing = useCallback(
    async (input: CreateLeasingInput) => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      await api.post(`/org/${orgId}/asset-leasings`, input);
      await refetch();
    },
    [orgId, refetch],
  );

  const exercisePurchase = useCallback(
    async (id: string) => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      await api.post(`/org/${orgId}/asset-leasings/${id}/exercise-purchase`, {});
      await refetch();
    },
    [orgId, refetch],
  );

  const returnAsset = useCallback(
    async (id: string) => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      await api.post(`/org/${orgId}/asset-leasings/${id}/return`, {});
      await refetch();
    },
    [orgId, refetch],
  );

  const cancelLeasing = useCallback(
    async (id: string) => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      await api.post(`/org/${orgId}/asset-leasings/${id}/cancel`, {});
      await refetch();
    },
    [orgId, refetch],
  );

  return {
    ...state,
    fetchLeasings,
    createLeasing,
    exercisePurchase,
    returnAsset,
    cancelLeasing,
    refetch,
  };
}
