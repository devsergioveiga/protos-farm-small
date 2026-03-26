import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { MaintenanceDashboard } from '@/types/maintenance';

// ─── State ────────────────────────────────────────────────────────────

interface UseMaintenanceDashboardState {
  dashboard: MaintenanceDashboard | null;
  loading: boolean;
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useMaintenanceDashboard() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [state, setState] = useState<UseMaintenanceDashboardState>({
    dashboard: null,
    loading: false,
    error: null,
  });

  const fetchDashboard = useCallback(async () => {
    if (!orgId) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await api.get<MaintenanceDashboard>(`/org/${orgId}/work-orders/dashboard`);
      setState({ dashboard: result, loading: false, error: null });
    } catch {
      setState({
        dashboard: null,
        loading: false,
        error: 'Nao foi possivel carregar o dashboard de manutencao. Verifique sua conexao.',
      });
    }
  }, [orgId]);

  return {
    ...state,
    fetchDashboard,
  };
}
