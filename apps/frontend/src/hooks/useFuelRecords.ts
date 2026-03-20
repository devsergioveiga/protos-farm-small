import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────

export interface FuelRecord {
  id: string;
  assetId: string;
  farmId: string;
  fuelDate: string;
  liters: string;
  pricePerLiter: string;
  totalCost: string;
  hourmeterAtFuel: string | null;
  odometerAtFuel: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FuelStats {
  assetAvgLitersPerHour: number | null;
  fleetAvgLitersPerHour: number | null;
  assetCostPerHour: number | null;
  fleetCostPerHour: number | null;
  totalLiters: string;
  totalCost: string;
  recordCount: number;
}

export interface CreateFuelRecordInput {
  assetId: string;
  farmId: string;
  fuelDate: string;
  liters: string;
  pricePerLiter: string;
  hourmeterAtFuel?: string;
  odometerAtFuel?: string;
  notes?: string;
}

interface FuelRecordListResponse {
  data: FuelRecord[];
  total: number;
  page: number;
  limit: number;
}

// ─── useFuelRecords ───────────────────────────────────────────────────

export function useFuelRecords(assetId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [stats, setStats] = useState<FuelStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!orgId || !assetId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<FuelRecordListResponse>(
        `/org/${orgId}/fuel-records?assetId=${assetId}`,
      );
      setRecords(result.data);
    } catch {
      setError('Nao foi possivel carregar os abastecimentos.');
    } finally {
      setLoading(false);
    }
  }, [orgId, assetId]);

  const fetchStats = useCallback(async () => {
    if (!orgId || !assetId) return;
    try {
      const result = await api.get<FuelStats>(`/org/${orgId}/fuel-records/stats/${assetId}`);
      setStats(result);
    } catch {
      // Non-critical
    }
  }, [orgId, assetId]);

  useEffect(() => {
    if (assetId) {
      void fetchRecords();
      void fetchStats();
    } else {
      setRecords([]);
      setStats(null);
    }
  }, [assetId, fetchRecords, fetchStats]);

  const createRecord = useCallback(
    async (input: CreateFuelRecordInput) => {
      if (!orgId) return;
      await api.post(`/org/${orgId}/fuel-records`, input);
      await Promise.all([fetchRecords(), fetchStats()]);
    },
    [orgId, fetchRecords, fetchStats],
  );

  const deleteRecord = useCallback(
    async (id: string) => {
      if (!orgId) return;
      await api.delete(`/org/${orgId}/fuel-records/${id}`);
      await Promise.all([fetchRecords(), fetchStats()]);
    },
    [orgId, fetchRecords, fetchStats],
  );

  return { records, stats, loading, error, createRecord, deleteRecord };
}
