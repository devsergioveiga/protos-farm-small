import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { PayrollLegalTable, CreateLegalTableInput, LegalTableType } from '@/types/payroll';

interface UsePayrollTablesResult {
  tables: PayrollLegalTable[];
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  fetchTables: (tableType?: LegalTableType) => Promise<void>;
  createTable: (data: CreateLegalTableInput) => Promise<boolean>;
  clearSuccess: () => void;
}

export function usePayrollTables(): UsePayrollTablesResult {
  const { user } = useAuth();
  const [tables, setTables] = useState<PayrollLegalTable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchTables = useCallback(
    async (tableType?: LegalTableType) => {
      const orgId = user?.organizationId;
      if (!orgId) {
        setTables([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const query = tableType ? `?tableType=${tableType}` : '';
        const result = await api.get<PayrollLegalTable[]>(`/org/${orgId}/payroll-tables${query}`);
        setTables(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar tabelas';
        setError(message);
        setTables([]);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.organizationId],
  );

  const createTable = useCallback(
    async (data: CreateLegalTableInput): Promise<boolean> => {
      const orgId = user?.organizationId;
      if (!orgId) return false;

      try {
        await api.post<PayrollLegalTable>(`/org/${orgId}/payroll-tables`, data);
        setSuccessMessage('Tabela cadastrada com sucesso');
        await fetchTables();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao cadastrar tabela';
        setError(`Não foi possível salvar. ${message}`);
        return false;
      }
    },
    [user?.organizationId, fetchTables],
  );

  const clearSuccess = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  return {
    tables,
    isLoading,
    error,
    successMessage,
    fetchTables,
    createTable,
    clearSuccess,
  };
}
