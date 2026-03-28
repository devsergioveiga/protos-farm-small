import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { TrainingRecord, CreateTrainingRecordInput } from '@/types/training';

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useTrainingRecords() {
  const [trainingRecords, setTrainingRecords] = useState<PaginatedResult<TrainingRecord> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── Training Records ────────────────────────────────────────────

  const fetchTrainingRecords = useCallback(
    async (params?: {
      trainingTypeId?: string;
      instructorType?: string;
      dateFrom?: string;
      dateTo?: string;
      farmId?: string;
      page?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams();
        if (params?.trainingTypeId) sp.set('trainingTypeId', params.trainingTypeId);
        if (params?.instructorType) sp.set('instructorType', params.instructorType);
        if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
        if (params?.dateTo) sp.set('dateTo', params.dateTo);
        if (params?.farmId) sp.set('farmId', params.farmId);
        if (params?.page) sp.set('page', String(params.page));
        if (params?.limit) sp.set('limit', String(params.limit));
        const qs = sp.toString();
        const data = await api.get<PaginatedResult<TrainingRecord>>(
          `/org/training-records${qs ? `?${qs}` : ''}`,
        );
        setTrainingRecords(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar registros de treinamento');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createTrainingRecord = useCallback(async (input: CreateTrainingRecordInput) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/org/training-records', input);
      setSuccessMessage('Treinamento registrado. Certificados disponíveis para download.');
      return true;
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar. Verifique os dados e tente novamente.',
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTrainingRecord = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/org/training-records/${id}`);
      setSuccessMessage('Registro de treinamento removido com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover registro');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Certificate PDF ─────────────────────────────────────────────

  const downloadCertificatePdf = useCallback(
    async (trainingRecordId: string, employeeId: string) => {
      try {
        const blob = await api.getBlob(
          `/org/training-records/${trainingRecordId}/employees/${employeeId}/certificate`,
        );
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch {
        setError('Não foi possível gerar o PDF. Tente novamente.');
      }
    },
    [],
  );

  return {
    trainingRecords,
    loading,
    error,
    successMessage,
    fetchTrainingRecords,
    createTrainingRecord,
    deleteTrainingRecord,
    downloadCertificatePdf,
  };
}
