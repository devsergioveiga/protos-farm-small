import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { InventoryOutput } from '@/types/asset';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateInventoryInput {
  farmId?: string;
  notes?: string;
}

interface CountItem {
  assetId: string;
  physicalStatus: string;
  notes?: string;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAssetInventory() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventories, setInventories] = useState<InventoryOutput[]>([]);
  const [inventory, setInventory] = useState<InventoryOutput | null>(null);

  const createInventory = useCallback(
    async (data: CreateInventoryInput): Promise<InventoryOutput> => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.post<InventoryOutput>(`/org/${orgId}/asset-inventories`, data);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel criar o inventario. Tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  const listInventories = useCallback(
    async (query?: { farmId?: string; status?: string }): Promise<InventoryOutput[]> => {
      if (!orgId) return [];
      setIsLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (query?.farmId) qs.set('farmId', query.farmId);
        if (query?.status) qs.set('status', query.status);
        const result = await api.get<InventoryOutput[]>(
          `/org/${orgId}/asset-inventories${qs.toString() ? `?${qs.toString()}` : ''}`,
        );
        setInventories(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel carregar os inventarios. Verifique sua conexao.';
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  const getInventory = useCallback(
    async (id: string): Promise<InventoryOutput | null> => {
      if (!orgId) return null;
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.get<InventoryOutput>(`/org/${orgId}/asset-inventories/${id}`);
        setInventory(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel carregar o inventario.';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  const countItems = useCallback(
    async (id: string, items: CountItem[]): Promise<InventoryOutput | null> => {
      if (!orgId) return null;
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.patch<InventoryOutput>(
          `/org/${orgId}/asset-inventories/${id}/count`,
          { items },
        );
        setInventory(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel salvar a contagem. Tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  const reconcileInventory = useCallback(
    async (id: string): Promise<InventoryOutput | null> => {
      if (!orgId) return null;
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.post<InventoryOutput>(
          `/org/${orgId}/asset-inventories/${id}/reconcile`,
          {},
        );
        setInventory(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel conciliar o inventario. Tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  const refetch = useCallback(() => {
    void listInventories();
  }, [listInventories]);

  return {
    inventories,
    inventory,
    createInventory,
    listInventories,
    getInventory,
    countItems,
    reconcileInventory,
    isLoading,
    error,
    refetch,
  };
}
