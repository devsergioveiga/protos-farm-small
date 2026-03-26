import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  PayrollRubrica,
  PayrollRubricasResponse,
  CreateRubricaInput,
  UpdateRubricaInput,
} from '@/types/payroll';

interface UsePayrollRubricasResult {
  rubricas: PayrollRubrica[];
  total: number;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  fetchRubricas: () => Promise<void>;
  createRubrica: (data: CreateRubricaInput) => Promise<boolean>;
  updateRubrica: (id: string, data: UpdateRubricaInput) => Promise<boolean>;
  deactivateRubrica: (id: string) => Promise<boolean>;
  clearSuccess: () => void;
}

export function usePayrollRubricas(): UsePayrollRubricasResult {
  const { user } = useAuth();
  const [rubricas, setRubricas] = useState<PayrollRubrica[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchRubricas = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId) {
      setRubricas([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<PayrollRubricasResponse>(
        `/org/${orgId}/payroll-rubricas?limit=200`,
      );
      setRubricas(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar rubricas';
      setError(message);
      setRubricas([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId]);

  const createRubrica = useCallback(
    async (data: CreateRubricaInput): Promise<boolean> => {
      const orgId = user?.organizationId;
      if (!orgId) return false;

      try {
        await api.post<PayrollRubrica>(`/org/${orgId}/payroll-rubricas`, data);
        setSuccessMessage('Rubrica criada com sucesso');
        await fetchRubricas();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao criar rubrica';
        setError(`Não foi possível salvar. ${message}`);
        return false;
      }
    },
    [user?.organizationId, fetchRubricas],
  );

  const updateRubrica = useCallback(
    async (id: string, data: UpdateRubricaInput): Promise<boolean> => {
      const orgId = user?.organizationId;
      if (!orgId) return false;

      try {
        await api.put<PayrollRubrica>(`/org/${orgId}/payroll-rubricas/${id}`, data);
        setSuccessMessage('Rubrica atualizada com sucesso');
        await fetchRubricas();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao atualizar rubrica';
        setError(`Não foi possível salvar. ${message}`);
        return false;
      }
    },
    [user?.organizationId, fetchRubricas],
  );

  const deactivateRubrica = useCallback(
    async (id: string): Promise<boolean> => {
      const orgId = user?.organizationId;
      if (!orgId) return false;

      try {
        await api.patch<PayrollRubrica>(`/org/${orgId}/payroll-rubricas/${id}/deactivate`, {});
        setSuccessMessage('Rubrica desativada com sucesso');
        await fetchRubricas();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao desativar rubrica';
        setError(`Não foi possível salvar. ${message}`);
        return false;
      }
    },
    [user?.organizationId, fetchRubricas],
  );

  const clearSuccess = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  return {
    rubricas,
    total,
    isLoading,
    error,
    successMessage,
    fetchRubricas,
    createRubrica,
    updateRubrica,
    deactivateRubrica,
    clearSuccess,
  };
}
