import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  PrescriptionItem,
  PrescriptionsResponse,
  CreatePrescriptionInput,
} from '@/types/pesticide-prescription';

interface UsePrescriptionsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  fieldPlotId?: string;
}

interface UsePrescriptionsResult {
  prescriptions: PrescriptionItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createPrescription: (input: CreatePrescriptionInput) => Promise<PrescriptionItem>;
  updatePrescription: (
    id: string,
    input: Partial<CreatePrescriptionInput>,
  ) => Promise<PrescriptionItem>;
  cancelPrescription: (id: string) => Promise<void>;
  downloadPdf: (id: string, sequentialNumber: number) => Promise<void>;
  downloadCsv: () => Promise<void>;
}

export function usePesticidePrescriptions(params: UsePrescriptionsParams): UsePrescriptionsResult {
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page = 1, limit = 20, status, search, fieldPlotId } = params;

  const fetchPrescriptions = useCallback(async () => {
    if (!farmId) {
      setPrescriptions([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', String(limit));
      if (status) query.set('status', status);
      if (search) query.set('search', search);
      if (fieldPlotId) query.set('fieldPlotId', fieldPlotId);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/pesticide-prescriptions${qs ? `?${qs}` : ''}`;
      const result = await api.get<PrescriptionsResponse>(path);
      setPrescriptions(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar receituários';
      setError(message);
      setPrescriptions([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, status, search, fieldPlotId]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const createPrescription = useCallback(
    async (input: CreatePrescriptionInput): Promise<PrescriptionItem> => {
      if (!farmId) throw new Error('Fazenda não selecionada');
      const result = await api.post<PrescriptionItem>(
        `/org/farms/${farmId}/pesticide-prescriptions`,
        input,
      );
      return result;
    },
    [farmId],
  );

  const updatePrescription = useCallback(
    async (id: string, input: Partial<CreatePrescriptionInput>): Promise<PrescriptionItem> => {
      if (!farmId) throw new Error('Fazenda não selecionada');
      const result = await api.patch<PrescriptionItem>(
        `/org/farms/${farmId}/pesticide-prescriptions/${id}`,
        input,
      );
      return result;
    },
    [farmId],
  );

  const cancelPrescription = useCallback(
    async (id: string): Promise<void> => {
      if (!farmId) throw new Error('Fazenda não selecionada');
      await api.delete(`/org/farms/${farmId}/pesticide-prescriptions/${id}`);
    },
    [farmId],
  );

  const downloadPdf = useCallback(
    async (id: string, sequentialNumber: number): Promise<void> => {
      if (!farmId) throw new Error('Fazenda não selecionada');
      const blob = await api.getBlob(`/org/farms/${farmId}/pesticide-prescriptions/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receituario_${String(sequentialNumber).padStart(6, '0')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [farmId],
  );

  const downloadCsv = useCallback(async (): Promise<void> => {
    if (!farmId) throw new Error('Fazenda não selecionada');
    const blob = await api.getBlob(`/org/farms/${farmId}/pesticide-prescriptions/export/csv`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receituarios.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [farmId]);

  return {
    prescriptions,
    total,
    page,
    limit,
    isLoading,
    error,
    refetch: fetchPrescriptions,
    createPrescription,
    updatePrescription,
    cancelPrescription,
    downloadPdf,
    downloadCsv,
  };
}
