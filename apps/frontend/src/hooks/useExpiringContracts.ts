import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { ExpiringContractAlert, ExpiringContractsResponse } from '@/types/farm-producer';

export function useExpiringContracts(days = 30) {
  const [alerts, setAlerts] = useState<ExpiringContractAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpiring = useCallback(async (d: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<ExpiringContractsResponse>(`/org/contracts/expiring?days=${d}`);
      setAlerts(data.alerts);
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar contratos vencendo';
      setError(message);
      setAlerts([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExpiring(days);
  }, [days, fetchExpiring]);

  const refetch = useCallback(() => {
    void fetchExpiring(days);
  }, [days, fetchExpiring]);

  return { alerts, total, isLoading, error, refetch };
}
