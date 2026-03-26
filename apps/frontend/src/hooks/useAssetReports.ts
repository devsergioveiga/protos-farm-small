import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface InventoryReportRow {
  classification: string;
  count: number;
  grossValue: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  acquisitionsInPeriod: number;
  disposalsInPeriod: number;
}

export interface InventoryReportResult {
  rows: InventoryReportRow[];
  totals: {
    count: number;
    grossValue: number;
    accumulatedDepreciation: number;
    netBookValue: number;
  };
  generatedAt: string;
}

export interface UseAssetReportsParams {
  farmId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAssetReports(params: UseAssetReportsParams = {}) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [data, setData] = useState<InventoryReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async (): Promise<InventoryReportResult | null> => {
    if (!orgId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (params.farmId) qs.set('farmId', params.farmId);
      if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
      if (params.dateTo) qs.set('dateTo', params.dateTo);
      const query = qs.toString();
      const result = await api.get<InventoryReportResult>(
        `/orgs/${orgId}/asset-reports/inventory${query ? `?${query}` : ''}`,
      );
      setData(result);
      return result;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar o relatorio de inventario. Verifique sua conexao.';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [orgId, params.farmId, params.dateFrom, params.dateTo]);

  useEffect(() => {
    if (orgId) {
      void fetchInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, params.farmId, params.dateFrom, params.dateTo]);

  const exportReport = useCallback(
    async (format: 'pdf' | 'xlsx' | 'csv'): Promise<void> => {
      if (!orgId) return;
      try {
        const qs = new URLSearchParams({ format });
        if (params.farmId) qs.set('farmId', params.farmId);
        if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
        if (params.dateTo) qs.set('dateTo', params.dateTo);

        const token = localStorage.getItem('protos_access_token');
        const response = await fetch(
          `/api/orgs/${orgId}/asset-reports/inventory/export?${qs.toString()}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );

        if (!response.ok) throw new Error('Falha ao exportar relatorio');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventario-patrimonial.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Erro ao exportar relatorio:', err);
      }
    },
    [orgId, params.farmId, params.dateFrom, params.dateTo],
  );

  return {
    data,
    isLoading,
    error,
    fetchInventory,
    exportReport,
  };
}
