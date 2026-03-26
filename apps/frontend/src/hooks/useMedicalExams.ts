import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  MedicalExam,
  CreateMedicalExamInput,
  UpdateMedicalExamInput,
  AsoType,
  AsoResult,
} from '@/types/medical-exam';

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useMedicalExams() {
  const [medicalExams, setMedicalExams] = useState<PaginatedResult<MedicalExam> | null>(null);
  const [employeeExams, setEmployeeExams] = useState<MedicalExam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── Medical Exams ───────────────────────────────────────────────

  const fetchMedicalExams = useCallback(
    async (params?: {
      employeeId?: string;
      type?: AsoType;
      result?: AsoResult;
      expiryStatus?: string;
      farmId?: string;
      page?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams();
        if (params?.employeeId) sp.set('employeeId', params.employeeId);
        if (params?.type) sp.set('type', params.type);
        if (params?.result) sp.set('result', params.result);
        if (params?.expiryStatus) sp.set('expiryStatus', params.expiryStatus);
        if (params?.farmId) sp.set('farmId', params.farmId);
        if (params?.page) sp.set('page', String(params.page));
        if (params?.limit) sp.set('limit', String(params.limit));
        const qs = sp.toString();
        const data = await api.get<PaginatedResult<MedicalExam>>(
          `/org/medical-exams${qs ? `?${qs}` : ''}`,
        );
        setMedicalExams(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar ASOs');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchEmployeeExams = useCallback(async (employeeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<MedicalExam[]>(
        `/org/medical-exams/employees/${employeeId}`,
      );
      setEmployeeExams(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar ASOs do colaborador');
    } finally {
      setLoading(false);
    }
  }, []);

  const createMedicalExam = useCallback(async (input: CreateMedicalExamInput) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/org/medical-exams', input);
      setSuccessMessage('ASO registrado com sucesso.');
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

  const updateMedicalExam = useCallback(async (id: string, input: UpdateMedicalExamInput) => {
    setLoading(true);
    setError(null);
    try {
      await api.put(`/org/medical-exams/${id}`, input);
      setSuccessMessage('ASO atualizado com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar ASO');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteMedicalExam = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/org/medical-exams/${id}`);
      setSuccessMessage('ASO removido com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover ASO');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    medicalExams,
    employeeExams,
    loading,
    error,
    successMessage,
    fetchMedicalExams,
    fetchEmployeeExams,
    createMedicalExam,
    updateMedicalExam,
    deleteMedicalExam,
  };
}
