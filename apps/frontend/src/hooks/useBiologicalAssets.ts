import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  BiologicalValuationOutput,
  BiologicalValuationSummaryItem,
  CreateBiologicalValuationInput,
} from '@/types/asset';

interface UseBiologicalAssetsState {
  valuations: BiologicalValuationOutput[];
  summary: BiologicalValuationSummaryItem[];
  loading: boolean;
  error: string | null;
}

interface UseBiologicalAssetsResult extends UseBiologicalAssetsState {
  refetch: (farmId?: string, assetGroup?: string, groupType?: string) => Promise<void>;
  createValuation: (input: CreateBiologicalValuationInput) => Promise<void>;
  deleteValuation: (id: string) => Promise<void>;
}

export function useBiologicalAssets(): UseBiologicalAssetsResult {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [state, setState] = useState<UseBiologicalAssetsState>({
    valuations: [],
    summary: [],
    loading: false,
    error: null,
  });

  const fetchValuations = useCallback(
    async (farmId?: string, assetGroup?: string, groupType?: string) => {
      if (!orgId) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const qs = new URLSearchParams();
        if (farmId) qs.set('farmId', farmId);
        if (assetGroup) qs.set('assetGroup', assetGroup);
        if (groupType) qs.set('groupType', groupType);

        const [valuationsData, summaryData] = await Promise.all([
          api.get<BiologicalValuationOutput[]>(
            `/org/${orgId}/biological-assets${qs.toString() ? `?${qs.toString()}` : ''}`,
          ),
          api.get<BiologicalValuationSummaryItem[]>(
            `/org/${orgId}/biological-assets/summary${farmId ? `?farmId=${farmId}` : ''}`,
          ),
        ]);

        setState({
          valuations: valuationsData,
          summary: summaryData,
          loading: false,
          error: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar avaliacoes';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [orgId],
  );

  const createValuation = useCallback(
    async (input: CreateBiologicalValuationInput) => {
      if (!orgId) return;
      await api.post(`/org/${orgId}/biological-assets`, input);
      await fetchValuations(input.farmId);
    },
    [orgId, fetchValuations],
  );

  const deleteValuation = useCallback(
    async (id: string) => {
      if (!orgId) return;
      await api.delete(`/org/${orgId}/biological-assets/${id}`);
      await fetchValuations();
    },
    [orgId, fetchValuations],
  );

  return {
    ...state,
    refetch: fetchValuations,
    createValuation,
    deleteValuation,
  };
}
