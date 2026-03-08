import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { WithdrawalAlert } from '@/types/pesticide-application';

interface UseWithdrawalAlertsResult {
  alerts: WithdrawalAlert[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWithdrawalAlerts(farmId: string | null): UseWithdrawalAlertsResult {
  const [alerts, setAlerts] = useState<WithdrawalAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!farmId) {
      setAlerts([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<WithdrawalAlert[]>(
        `/org/farms/${farmId}/pesticide-applications/withdrawal-alerts`,
      );
      setAlerts(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar alertas de carência';
      setError(message);
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, isLoading, error, refetch: fetchAlerts };
}
