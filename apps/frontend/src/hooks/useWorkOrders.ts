import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  WorkOrder,
  CreateWorkOrderInput,
  AddWorkOrderPartInput,
  CloseWorkOrderInput,
  MaintenanceDashboard,
} from '@/types/maintenance';

// ─── State ────────────────────────────────────────────────────────────

interface UseWorkOrdersState {
  workOrders: WorkOrder[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
}

export interface ListWorkOrdersQuery {
  page?: number;
  limit?: number;
  assetId?: string;
  status?: string;
  type?: string;
  search?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useWorkOrders() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [state, setState] = useState<UseWorkOrdersState>({
    workOrders: [],
    loading: false,
    error: null,
    total: 0,
    page: 1,
    totalPages: 1,
  });

  const fetchWorkOrders = useCallback(
    async (query: ListWorkOrdersQuery = {}) => {
      if (!orgId) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const qs = new URLSearchParams();
        if (query.page) qs.set('page', String(query.page));
        if (query.limit) qs.set('limit', String(query.limit));
        if (query.assetId) qs.set('assetId', query.assetId);
        if (query.status) qs.set('status', query.status);
        if (query.type) qs.set('type', query.type);
        if (query.search) qs.set('search', query.search);

        const result = await api.get<{
          data: WorkOrder[];
          total: number;
          page: number;
          totalPages: number;
        }>(`/org/${orgId}/work-orders${qs.toString() ? `?${qs.toString()}` : ''}`);

        setState((prev) => ({
          ...prev,
          workOrders: result.data,
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          loading: false,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Nao foi possivel carregar as ordens de servico. Verifique sua conexao.',
          workOrders: [],
        }));
      }
    },
    [orgId],
  );

  const createWorkOrder = useCallback(
    async (input: CreateWorkOrderInput, onSuccess?: (wo: WorkOrder) => void): Promise<void> => {
      if (!orgId) return;
      const wo = await api.post<WorkOrder>(`/org/${orgId}/work-orders`, input);
      onSuccess?.(wo);
    },
    [orgId],
  );

  const updateWorkOrder = useCallback(
    async (
      id: string,
      input: Partial<CreateWorkOrderInput>,
      onSuccess?: () => void,
    ): Promise<void> => {
      if (!orgId) return;
      await api.patch(`/org/${orgId}/work-orders/${id}`, input);
      onSuccess?.();
    },
    [orgId],
  );

  const addPart = useCallback(
    async (workOrderId: string, input: AddWorkOrderPartInput): Promise<void> => {
      if (!orgId) return;
      await api.post(`/org/${orgId}/work-orders/${workOrderId}/parts`, input);
    },
    [orgId],
  );

  const removePart = useCallback(
    async (workOrderId: string, partId: string): Promise<void> => {
      if (!orgId) return;
      await api.delete(`/org/${orgId}/work-orders/${workOrderId}/parts/${partId}`);
    },
    [orgId],
  );

  const closeWorkOrder = useCallback(
    async (id: string, input: CloseWorkOrderInput, onSuccess?: () => void): Promise<void> => {
      if (!orgId) return;
      await api.patch(`/org/${orgId}/work-orders/${id}/close`, input);
      onSuccess?.();
    },
    [orgId],
  );

  const cancelWorkOrder = useCallback(
    async (id: string, onSuccess?: () => void): Promise<void> => {
      if (!orgId) return;
      await api.patch(`/org/${orgId}/work-orders/${id}/cancel`, {});
      onSuccess?.();
    },
    [orgId],
  );

  const fetchDashboard = useCallback(async (): Promise<MaintenanceDashboard | null> => {
    if (!orgId) return null;
    try {
      return await api.get<MaintenanceDashboard>(`/org/${orgId}/work-orders/dashboard`);
    } catch {
      return null;
    }
  }, [orgId]);

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  return {
    ...state,
    fetchWorkOrders,
    createWorkOrder,
    updateWorkOrder,
    addPart,
    removePart,
    closeWorkOrder,
    cancelWorkOrder,
    fetchDashboard,
    setPage,
  };
}
