import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  MaintenancePlan,
  CreateMaintenancePlanInput,
  UpdateMaintenancePlanInput,
} from '@/types/maintenance';

// ─── State ────────────────────────────────────────────────────────────

interface UseMaintenancePlansState {
  plans: MaintenancePlan[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
}

export interface ListMaintenancePlansQuery {
  page?: number;
  limit?: number;
  assetId?: string;
  isActive?: boolean;
  triggerType?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useMaintenancePlans() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [state, setState] = useState<UseMaintenancePlansState>({
    plans: [],
    loading: false,
    error: null,
    total: 0,
    page: 1,
    totalPages: 1,
  });

  const fetchPlans = useCallback(
    async (query: ListMaintenancePlansQuery = {}) => {
      if (!orgId) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const qs = new URLSearchParams();
        if (query.page) qs.set('page', String(query.page));
        if (query.limit) qs.set('limit', String(query.limit));
        if (query.assetId) qs.set('assetId', query.assetId);
        if (query.isActive !== undefined) qs.set('isActive', String(query.isActive));
        if (query.triggerType) qs.set('triggerType', query.triggerType);

        const result = await api.get<{
          data: MaintenancePlan[];
          total: number;
          page: number;
          totalPages: number;
        }>(`/org/${orgId}/maintenance-plans${qs.toString() ? `?${qs.toString()}` : ''}`);

        setState((prev) => ({
          ...prev,
          plans: result.data,
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          loading: false,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Nao foi possivel carregar os planos de manutencao. Verifique sua conexao.',
          plans: [],
        }));
      }
    },
    [orgId],
  );

  const createPlan = useCallback(
    async (input: CreateMaintenancePlanInput, onSuccess?: () => void): Promise<void> => {
      if (!orgId) return;
      await api.post(`/org/${orgId}/maintenance-plans`, input);
      onSuccess?.();
    },
    [orgId],
  );

  const updatePlan = useCallback(
    async (
      id: string,
      input: UpdateMaintenancePlanInput,
      onSuccess?: () => void,
    ): Promise<void> => {
      if (!orgId) return;
      await api.put(`/org/${orgId}/maintenance-plans/${id}`, input);
      onSuccess?.();
    },
    [orgId],
  );

  const deletePlan = useCallback(
    async (id: string): Promise<void> => {
      if (!orgId) return;
      await api.delete(`/org/${orgId}/maintenance-plans/${id}`);
    },
    [orgId],
  );

  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<void> => {
      if (!orgId) return;
      await api.put(`/org/${orgId}/maintenance-plans/${id}`, { isActive });
    },
    [orgId],
  );

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  return {
    ...state,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
    toggleActive,
    setPage,
  };
}
