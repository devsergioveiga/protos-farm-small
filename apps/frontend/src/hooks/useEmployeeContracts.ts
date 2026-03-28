import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { EmployeeContract, EmployeeContractsResponse } from '@/types/employee-contract';

interface UseEmployeeContractsParams {
  employeeId?: string;
  page?: number;
  limit?: number;
}

interface UseEmployeeContractsResult {
  contracts: EmployeeContract[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmployeeContracts(
  params: UseEmployeeContractsParams = {},
): UseEmployeeContractsResult {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { employeeId, page, limit } = params;

  const fetchContracts = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId) {
      setContracts([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (employeeId) query.set('employeeId', employeeId);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));

      const qs = query.toString();
      const path = `/org/${orgId}/employee-contracts${qs ? `?${qs}` : ''}`;
      const result = await api.get<EmployeeContractsResponse>(path);
      setContracts(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar contratos';
      setError(message);
      setContracts([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, employeeId, page, limit]);

  useEffect(() => {
    void fetchContracts();
  }, [fetchContracts]);

  return { contracts, total, isLoading, error, refetch: fetchContracts };
}
