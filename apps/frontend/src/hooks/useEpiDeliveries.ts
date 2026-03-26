import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { EpiDelivery, CreateEpiDeliveryInput } from '@/types/epi';

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useEpiDeliveries() {
  const [deliveries, setDeliveries] = useState<PaginatedResult<EpiDelivery> | null>(null);
  const [employeeDeliveries, setEmployeeDeliveries] = useState<EpiDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── Deliveries ──────────────────────────────────────────────────

  const fetchEpiDeliveries = useCallback(
    async (params?: {
      employeeId?: string;
      epiType?: string;
      dateFrom?: string;
      dateTo?: string;
      complianceStatus?: string;
      farmId?: string;
      page?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams();
        if (params?.employeeId) sp.set('employeeId', params.employeeId);
        if (params?.epiType) sp.set('epiType', params.epiType);
        if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
        if (params?.dateTo) sp.set('dateTo', params.dateTo);
        if (params?.complianceStatus) sp.set('complianceStatus', params.complianceStatus);
        if (params?.farmId) sp.set('farmId', params.farmId);
        if (params?.page) sp.set('page', String(params.page));
        if (params?.limit) sp.set('limit', String(params.limit));
        const qs = sp.toString();
        const data = await api.get<PaginatedResult<EpiDelivery>>(
          `/org/epi-deliveries${qs ? `?${qs}` : ''}`,
        );
        setDeliveries(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar entregas');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchEmployeeDeliveries = useCallback(async (employeeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<EpiDelivery[]>(
        `/org/epi-deliveries/employees/${employeeId}`,
      );
      setEmployeeDeliveries(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar ficha de EPI');
    } finally {
      setLoading(false);
    }
  }, []);

  const createEpiDelivery = useCallback(async (input: CreateEpiDeliveryInput) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/org/epi-deliveries', input);
      setSuccessMessage('Entrega registrada. Estoque atualizado automaticamente.');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar entrega';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteEpiDelivery = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/org/epi-deliveries/${id}`);
      setSuccessMessage('Entrega removida com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover entrega');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── PDF Download ────────────────────────────────────────────────

  const downloadEpiFichaPdf = useCallback(async (employeeId: string) => {
    try {
      const blob = await api.getBlob(`/org/epi-deliveries/employees/${employeeId}/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o PDF. Tente novamente.');
    }
  }, []);

  return {
    deliveries,
    employeeDeliveries,
    loading,
    error,
    successMessage,
    fetchEpiDeliveries,
    fetchEmployeeDeliveries,
    createEpiDelivery,
    deleteEpiDelivery,
    downloadEpiFichaPdf,
  };
}
