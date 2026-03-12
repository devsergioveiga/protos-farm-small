import { useState, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export type InventoryStatus = 'OPEN' | 'IN_PROGRESS' | 'RECONCILED' | 'CANCELLED';

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productType: string;
  measurementUnit: string | null;
  batchNumber: string | null;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  reason: string | null;
}

export interface Inventory {
  id: string;
  inventoryDate: string;
  status: InventoryStatus;
  statusLabel: string;
  storageFarmId: string | null;
  storageFarmName: string | null;
  storageLocation: string | null;
  notes: string | null;
  reconciledAt: string | null;
  reconciledBy: string | null;
  createdBy: string | null;
  items: InventoryItem[];
  itemCount: number;
  countedCount: number;
  divergenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Adjustment {
  id: string;
  stockInventoryId: string;
  productId: string;
  productName: string;
  adjustmentType: 'INVENTORY_SURPLUS' | 'INVENTORY_SHORTAGE';
  adjustmentTypeLabel: string;
  previousQuantity: number;
  newQuantity: number;
  adjustmentQty: number;
  reason: string;
  createdBy: string | null;
  createdAt: string;
}

export interface InventoryReport {
  inventory: Inventory;
  adjustments: Adjustment[];
  summary: {
    totalItems: number;
    countedItems: number;
    matchCount: number;
    surplusCount: number;
    shortageCount: number;
    totalSurplusValue: number;
    totalShortageValue: number;
  };
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useStockInventories() {
  const [inventories, setInventories] = useState<PaginatedResult<Inventory> | null>(null);
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── List ─────────────────────────────────────────────────────────

  const fetchInventories = useCallback(
    async (params?: {
      status?: InventoryStatus;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.set('status', params.status);
        if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
        if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));

        const qs = searchParams.toString();
        const data = await api.get<PaginatedResult<Inventory>>(
          `/org/stock-inventories${qs ? `?${qs}` : ''}`,
        );
        setInventories(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar inventários');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ─── Get by ID ────────────────────────────────────────────────────

  const fetchInventory = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Inventory>(`/org/stock-inventories/${id}`);
      setCurrentInventory(data);
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar inventário');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Create ───────────────────────────────────────────────────────

  const createInventory = useCallback(
    async (input: {
      inventoryDate?: string;
      storageFarmId?: string;
      storageLocation?: string;
      notes?: string;
      productIds?: string[];
    }) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.post<Inventory>('/org/stock-inventories', input);
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao criar inventário';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ─── Record Count ─────────────────────────────────────────────────

  const recordCount = useCallback(
    async (
      inventoryId: string,
      items: {
        productId: string;
        batchNumber?: string;
        countedQuantity: number;
        reason?: string;
      }[],
    ) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.post<Inventory>(`/org/stock-inventories/${inventoryId}/count`, {
          items,
        });
        setCurrentInventory(data);
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao registrar contagem';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ─── Reconcile ────────────────────────────────────────────────────

  const reconcileInventory = useCallback(
    async (inventoryId: string, items: { productId: string; reason: string }[]) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.post<InventoryReport>(
          `/org/stock-inventories/${inventoryId}/reconcile`,
          { items },
        );
        setReport(data);
        setCurrentInventory(data.inventory);
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao conciliar inventário';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ─── Cancel ───────────────────────────────────────────────────────

  const cancelInventory = useCallback(async (inventoryId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.patch<Inventory>(`/org/stock-inventories/${inventoryId}/cancel`);
      setCurrentInventory(data);
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cancelar inventário';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Report ───────────────────────────────────────────────────────

  const fetchReport = useCallback(async (inventoryId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<InventoryReport>(`/org/stock-inventories/${inventoryId}/report`);
      setReport(data);
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatório');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Export CSV ───────────────────────────────────────────────────

  const exportReportCSV = useCallback(async (inventoryId: string) => {
    const url = `/api/org/stock-inventories/${inventoryId}/report/export`;
    const token = localStorage.getItem('accessToken');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Erro ao exportar relatório');

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `inventario-${inventoryId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }, []);

  return {
    inventories,
    currentInventory,
    report,
    loading,
    error,
    fetchInventories,
    fetchInventory,
    createInventory,
    recordCount,
    reconcileInventory,
    cancelInventory,
    fetchReport,
    exportReportCSV,
  };
}
