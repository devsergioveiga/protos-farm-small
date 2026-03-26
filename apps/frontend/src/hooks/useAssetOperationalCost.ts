import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────

export interface OperationalCostData {
  acquisitionValue: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  maintenanceCost: number;
  fuelCost: number;
  insuranceCost: null;
  totalOperationalCost: number;
  totalLifetimeCost: number;
  costPerHour: number | null;
  currentHourmeter: number | null;
  fuelRecordCount: number;
  notes: string[];
}

// ─── useAssetOperationalCost ──────────────────────────────────────────

export function useAssetOperationalCost(assetId: string | undefined) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [data, setData] = useState<OperationalCostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCost = useCallback(async () => {
    if (!orgId || !assetId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<OperationalCostData>(
        `/org/${orgId}/assets/${assetId}/operational-cost`,
      );
      setData(result);
    } catch {
      setError('Não foi possível carregar custo operacional.');
    } finally {
      setLoading(false);
    }
  }, [orgId, assetId]);

  useEffect(() => {
    void fetchCost();
  }, [fetchCost]);

  return { data, loading, error, refetch: fetchCost };
}
