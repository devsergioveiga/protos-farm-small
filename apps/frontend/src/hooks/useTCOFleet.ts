import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TCOFleetRow {
  assetId: string;
  assetName: string;
  assetTag: string;
  assetType: string;
  acquisitionValue: number;
  accumulatedDepreciation: number;
  maintenanceCost: number;
  fuelCost: number;
  totalCost: number;
  repairRatio: number | null;
  alert: 'OK' | 'MONITOR' | 'REPLACE' | 'NO_DATA';
  costPerHour: number | null;
}

export interface TCOFleetResult {
  assets: TCOFleetRow[];
  summary: {
    avgCostPerHour: number;
    totalMaintenanceCost: number;
    totalFuelCost: number;
  };
  generatedAt: string;
}

export interface UseTCOFleetParams {
  farmId?: string;
  assetType?: string;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useTCOFleet(params: UseTCOFleetParams = {}) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [data, setData] = useState<TCOFleetResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTCOFleet = useCallback(async (): Promise<TCOFleetResult | null> => {
    if (!orgId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (params.farmId) qs.set('farmId', params.farmId);
      if (params.assetType) qs.set('assetType', params.assetType);
      const query = qs.toString();
      const result = await api.get<TCOFleetResult>(
        `/orgs/${orgId}/asset-reports/tco-fleet${query ? `?${query}` : ''}`,
      );
      setData(result);
      return result;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar os dados de TCO da frota. Verifique sua conexao.';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [orgId, params.farmId, params.assetType]);

  useEffect(() => {
    if (orgId) {
      void fetchTCOFleet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, params.farmId, params.assetType]);

  return {
    data,
    isLoading,
    error,
    fetchTCOFleet,
  };
}
