import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  WorkOrder,
  WorkOrderListResponse,
  ListWorkOrdersQuery,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  AddWorkOrderPartInput,
  CloseWorkOrderInput,
  MaintenanceDashboard,
} from '@/types/maintenance';

// ─── useWorkOrders ──────────────────────────────────────────────────────

interface UseWorkOrdersState {
  workOrders: WorkOrder[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  dashboard: MaintenanceDashboard | null;
}

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
    dashboard: null,
  });

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

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
        if (query.farmId) qs.set('farmId', query.farmId);
        if (query.dateFrom) qs.set('dateFrom', query.dateFrom);
        if (query.dateTo) qs.set('dateTo', query.dateTo);

        const result = await api.get<WorkOrderListResponse>(
          `/org/${orgId}/work-orders${qs.toString() ? `?${qs.toString()}` : ''}`,
        );
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
          error: 'Nao foi possivel carregar as ordens de servico. Verifique sua conexao e tente novamente.',
          workOrders: [],
        }));
      }
    },
    [orgId],
  );

  const createWorkOrder = useCallback(
    async (input: CreateWorkOrderInput, onSuccess?: (wo: WorkOrder) => void) => {
      if (!orgId) return;
      const result = await api.post<WorkOrder>(`/org/${orgId}/work-orders`, input);
      onSuccess?.(result);
      return result;
    },
    [orgId],
  );

  const updateWorkOrder = useCallback(
    async (id: string, input: UpdateWorkOrderInput, onSuccess?: () => void) => {
      if (!orgId) return;
      await api.patch(`/org/${orgId}/work-orders/${id}`, input);
      onSuccess?.();
    },
    [orgId],
  );

  const addPart = useCallback(
    async (workOrderId: string, input: AddWorkOrderPartInput, onSuccess?: () => void) => {
      if (!orgId) return;
      await api.post(`/org/${orgId}/work-orders/${workOrderId}/parts`, input);
      onSuccess?.();
    },
    [orgId],
  );

  const removePart = useCallback(
    async (workOrderId: string, partId: string, onSuccess?: () => void) => {
      if (!orgId) return;
      await api.delete(`/org/${orgId}/work-orders/${workOrderId}/parts/${partId}`);
      onSuccess?.();
    },
    [orgId],
  );

  const closeWorkOrder = useCallback(
    async (id: string, input: CloseWorkOrderInput, onSuccess?: () => void) => {
      if (!orgId) return;
      await api.patch(`/org/${orgId}/work-orders/${id}/close`, input);
      onSuccess?.();
    },
    [orgId],
  );

  const cancelWorkOrder = useCallback(
    async (id: string, onSuccess?: () => void) => {
      if (!orgId) return;
      await api.patch(`/org/${orgId}/work-orders/${id}/cancel`, {});
      onSuccess?.();
    },
    [orgId],
  );

  const fetchDashboard = useCallback(async () => {
    if (!orgId) return;
    try {
      const result = await api.get<MaintenanceDashboard>(`/org/${orgId}/work-orders/dashboard`);
      setState((prev) => ({ ...prev, dashboard: result }));
    } catch {
      // Dashboard failure is non-critical
    }
  }, [orgId]);

  return {
    ...state,
    setPage,
    fetchWorkOrders,
    createWorkOrder,
    updateWorkOrder,
    addPart,
    removePart,
    closeWorkOrder,
    cancelWorkOrder,
    fetchDashboard,
  };
}
