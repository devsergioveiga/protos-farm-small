import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { SalaryAdvance, CreateAdvanceInput, BatchAdvanceInput } from '@/types/payroll-runs';

interface FetchAdvancesFilters {
  month?: string;
  employeeId?: string;
}

interface BatchAdvanceResult {
  batchId: string;
  count: number;
  advances: SalaryAdvance[];
}

export function useSalaryAdvances() {
  const { user } = useAuth();
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const fetchAdvances = useCallback(
    async (filters?: FetchAdvancesFilters) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.month) params.set('month', filters.month);
        if (filters?.employeeId) params.set('employeeId', filters.employeeId);
        const qs = params.toString();
        const path = `/org/${orgId}/salary-advances${qs ? `?${qs}` : ''}`;
        const result = await api.get<SalaryAdvance[] | { data: SalaryAdvance[] }>(path);
        const items = Array.isArray(result) ? result : (result as { data: SalaryAdvance[] }).data;
        setAdvances(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar adiantamentos';
        setError(message);
        setAdvances([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const createAdvance = useCallback(
    async (data: CreateAdvanceInput): Promise<SalaryAdvance | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<SalaryAdvance>(`/org/${orgId}/salary-advances`, data);
        setSuccessMessage('Adiantamento registrado com sucesso');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar adiantamento';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const createBatchAdvances = useCallback(
    async (data: BatchAdvanceInput): Promise<BatchAdvanceResult | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<BatchAdvanceResult>(
          `/org/${orgId}/salary-advances/batch`,
          data,
        );
        setSuccessMessage(`Adiantamento em lote registrado para ${result.count} colaboradores.`);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao processar lote de adiantamentos';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const downloadReceipt = useCallback(
    async (advanceId: string): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(`/org/${orgId}/salary-advances/${advanceId}/receipt`);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recibo-adiantamento-${advanceId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao baixar recibo';
        setError(message);
      }
    },
    [orgId],
  );

  return {
    advances,
    loading,
    error,
    successMessage,
    fetchAdvances,
    createAdvance,
    createBatchAdvances,
    downloadReceipt,
  };
}
