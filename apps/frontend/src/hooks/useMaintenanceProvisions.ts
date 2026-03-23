import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  MaintenanceProvision,
  CreateMaintenanceProvisionInput,
  ProvisionReconciliation,
} from '@/types/maintenance';

// ─── State ────────────────────────────────────────────────────────────

interface UseMaintenanceProvisionsState {
  provisions: MaintenanceProvision[];
  reconciliation: ProvisionReconciliation | null;
  loading: boolean;
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useMaintenanceProvisions() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [state, setState] = useState<UseMaintenanceProvisionsState>({
    provisions: [],
    reconciliation: null,
    loading: false,
    error: null,
  });

  const fetchProvisions = useCallback(async () => {
    if (!orgId) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await api.get<{ data: MaintenanceProvision[] }>(
        `/org/${orgId}/maintenance-provisions`,
      );
      setState((prev) => ({
        ...prev,
        provisions: result.data,
        loading: false,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Nao foi possivel carregar as provisoes. Verifique sua conexao.',
        provisions: [],
      }));
    }
  }, [orgId]);

  const createProvision = useCallback(
    async (input: CreateMaintenanceProvisionInput, onSuccess?: () => void): Promise<void> => {
      if (!orgId) return;
      await api.post(`/org/${orgId}/maintenance-provisions`, input);
      onSuccess?.();
    },
    [orgId],
  );

  const updateProvision = useCallback(
    async (
      id: string,
      input: Partial<CreateMaintenanceProvisionInput>,
      onSuccess?: () => void,
    ): Promise<void> => {
      if (!orgId) return;
      await api.put(`/org/${orgId}/maintenance-provisions/${id}`, input);
      onSuccess?.();
    },
    [orgId],
  );

  const deleteProvision = useCallback(
    async (id: string): Promise<void> => {
      if (!orgId) return;
      await api.delete(`/org/${orgId}/maintenance-provisions/${id}`);
    },
    [orgId],
  );

  const fetchReconciliation = useCallback(
    async (year: number, month: number): Promise<void> => {
      if (!orgId) return;
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      const result = await api.get<ProvisionReconciliation>(
        `/org/${orgId}/maintenance-provisions/reconciliation?${qs.toString()}`,
      );
      setState((prev) => ({ ...prev, reconciliation: result }));
    },
    [orgId],
  );

  return {
    ...state,
    fetchProvisions,
    createProvision,
    updateProvision,
    deleteProvision,
    fetchReconciliation,
  };
}
