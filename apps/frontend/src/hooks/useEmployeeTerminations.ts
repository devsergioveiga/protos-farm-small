import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { EmployeeTermination, CreateTerminationInput } from '@/types/termination';

interface FetchTerminationsFilters {
  terminationType?: string;
  status?: string;
  employeeSearch?: string;
}

export function useEmployeeTerminations() {
  const { user } = useAuth();
  const [terminations, setTerminations] = useState<EmployeeTermination[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const fetchTerminations = useCallback(
    async (filters?: FetchTerminationsFilters) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.terminationType) params.set('terminationType', filters.terminationType);
        if (filters?.status) params.set('status', filters.status);
        if (filters?.employeeSearch) params.set('search', filters.employeeSearch);
        const qs = params.toString();
        const path = `/org/${orgId}/employee-terminations${qs ? `?${qs}` : ''}`;
        const result = await api.get<EmployeeTermination[] | { data: EmployeeTermination[] }>(path);
        const items = Array.isArray(result) ? result : (result as { data: EmployeeTermination[] }).data;
        setTerminations(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Nao foi possivel carregar os dados. Verifique sua conexao e tente novamente.';
        setError(message);
        setTerminations([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const processTermination = useCallback(
    async (data: CreateTerminationInput): Promise<EmployeeTermination | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<EmployeeTermination>(
          `/org/${orgId}/employee-terminations`,
          data,
        );
        setSuccessMessage('Rescisao processada. TRCT disponivel para download.');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao processar rescisao';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const confirmTermination = useCallback(
    async (terminationId: string): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.patch(`/org/${orgId}/employee-terminations/${terminationId}/confirm`, {});
        setSuccessMessage('Rescisao confirmada.');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao confirmar rescisao';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const markAsPaid = useCallback(
    async (terminationId: string): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.patch(`/org/${orgId}/employee-terminations/${terminationId}/pay`, {});
        setSuccessMessage('Rescisao marcada como paga.');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao marcar rescisao como paga';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const getTrctPdf = useCallback(
    async (terminationId: string, employeeName: string): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(
          `/org/${orgId}/employee-terminations/${terminationId}/trct`,
        );
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `TRCT-${employeeName.replace(/\s+/g, '-')}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Nao foi possivel gerar o PDF. Tente novamente ou entre em contato com o suporte.';
        setError(message);
      }
    },
    [orgId],
  );

  const getGrrfPdf = useCallback(
    async (terminationId: string, employeeName: string): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(
          `/org/${orgId}/employee-terminations/${terminationId}/grrf`,
        );
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `GRRF-${employeeName.replace(/\s+/g, '-')}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Nao foi possivel gerar o PDF. Tente novamente ou entre em contato com o suporte.';
        setError(message);
      }
    },
    [orgId],
  );

  return {
    terminations,
    loading,
    error,
    successMessage,
    fetchTerminations,
    processTermination,
    confirmTermination,
    markAsPaid,
    getTrctPdf,
    getGrrfPdf,
  };
}
