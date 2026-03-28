import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { Employee, EmployeesResponse } from '@/types/employee';

interface UseEmployeesParams {
  search?: string;
  status?: string;
  contractType?: string;
  farmId?: string;
  positionId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

interface UseEmployeesResult {
  employees: Employee[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmployees(params: UseEmployeesParams = {}): UseEmployeesResult {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, status, contractType, farmId, positionId, page, limit, sortBy, sortOrder } =
    params;

  const fetchEmployees = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId) {
      setEmployees([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (status) query.set('status', status);
      if (contractType) query.set('contractType', contractType);
      if (farmId) query.set('farmId', farmId);
      if (positionId) query.set('positionId', positionId);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (sortBy) query.set('sortBy', sortBy);
      if (sortOrder) query.set('sortOrder', sortOrder);

      const qs = query.toString();
      const path = `/org/${orgId}/employees${qs ? `?${qs}` : ''}`;
      const result = await api.get<EmployeesResponse>(path);
      setEmployees(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar colaboradores';
      setError(message);
      setEmployees([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    user?.organizationId,
    search,
    status,
    contractType,
    farmId,
    positionId,
    page,
    limit,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  return { employees, total, isLoading, error, refetch: fetchEmployees };
}

interface UseEmployeeResult {
  employee: Employee | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmployee(employeeId: string | null): UseEmployeeResult {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployee = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId || !employeeId) {
      setEmployee(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<Employee>(`/org/${orgId}/employees/${employeeId}`);
      setEmployee(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar colaborador';
      setError(message);
      setEmployee(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, employeeId]);

  useEffect(() => {
    void fetchEmployee();
  }, [fetchEmployee]);

  return { employee, isLoading, error, refetch: fetchEmployee };
}
