import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { EpiDelivery, EpiDeliveriesResponse, CreateEpiDeliveryInput } from '@/types/epi';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useEpiDeliveries() {
  const [deliveries, setDeliveries] = useState<EpiDeliveriesResponse | null>(null);
  const [employeeDeliveries, setEmployeeDeliveries] = useState<EpiDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── Deliveries List ─────────────────────────────────────────────────

  const fetchEpiDeliveries = useCallback(
    async (params?: {
      search?: string;
      epiType?: string;
      employeeId?: string;
      dateFrom?: string;
      dateTo?: string;
      complianceStatus?: string;
      page?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (params?.search) qs.set('search', params.search);
        if (params?.epiType) qs.set('epiType', params.epiType);
        if (params?.employeeId) qs.set('employeeId', params.employeeId);
        if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
        if (params?.dateTo) qs.set('dateTo', params.dateTo);
        if (params?.complianceStatus) qs.set('complianceStatus', params.complianceStatus);
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));

        const query = qs.toString();
        const data = await api.get<EpiDeliveriesResponse>(
          `/org/epi-deliveries${query ? `?${query}` : ''}`,
        );
        setDeliveries(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ─── Employee Deliveries (Ficha) ─────────────────────────────────────

  const fetchEmployeeDeliveries = useCallback(async (employeeId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<EpiDelivery[]>(`/org/epi-deliveries/employee/${employeeId}`);
      setEmployeeDeliveries(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Create ──────────────────────────────────────────────────────────

  const createEpiDelivery = useCallback(
    async (input: CreateEpiDeliveryInput): Promise<EpiDelivery> => {
      const data = await api.post<EpiDelivery>('/org/epi-deliveries', input);
      setSuccessMessage('Entrega registrada. Estoque atualizado automaticamente.');
      return data;
    },
    [],
  );

  // ─── Delete ──────────────────────────────────────────────────────────

  const deleteEpiDelivery = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/org/epi-deliveries/${id}`);
    setSuccessMessage('Entrega removida. Saldo de estoque restaurado.');
  }, []);

  // ─── PDF Download (Ficha EPI) ────────────────────────────────────────

  const downloadEpiFichaPdf = useCallback(
    async (employeeId: string, employeeName?: string): Promise<void> => {
      try {
        const blob = await api.getBlob(`/org/epi-deliveries/employee/${employeeId}/ficha-pdf`);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ficha-epi-${employeeName ?? employeeId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err: unknown) {
        throw err instanceof Error
          ? err
          : new Error('Não foi possível gerar o PDF. Tente novamente.');
      }
    },
    [],
  );

  return {
    deliveries,
    employeeDeliveries,
    loading,
    error,
    successMessage,
    setSuccessMessage,
    fetchEpiDeliveries,
    fetchEmployeeDeliveries,
    createEpiDelivery,
    deleteEpiDelivery,
    downloadEpiFichaPdf,
  };
}
