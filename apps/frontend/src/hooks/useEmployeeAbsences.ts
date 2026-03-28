import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { EmployeeAbsence, CreateAbsenceInput, RegisterReturnInput } from '@/types/absence';

interface FetchAbsencesFilters {
  employeeSearch?: string;
  absenceType?: string;
  startDate?: string;
  endDate?: string;
}

export function useEmployeeAbsences() {
  const { user } = useAuth();
  const [absences, setAbsences] = useState<EmployeeAbsence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const fetchAbsences = useCallback(
    async (filters?: FetchAbsencesFilters) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.employeeSearch) params.set('search', filters.employeeSearch);
        if (filters?.absenceType) params.set('absenceType', filters.absenceType);
        if (filters?.startDate) params.set('startDate', filters.startDate);
        if (filters?.endDate) params.set('endDate', filters.endDate);
        const qs = params.toString();
        const path = `/org/${orgId}/employee-absences${qs ? `?${qs}` : ''}`;
        const result = await api.get<EmployeeAbsence[] | { data: EmployeeAbsence[] }>(path);
        const items = Array.isArray(result) ? result : (result as { data: EmployeeAbsence[] }).data;
        setAbsences(items);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel carregar os dados. Verifique sua conexao e tente novamente.';
        setError(message);
        setAbsences([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const createAbsence = useCallback(
    async (data: CreateAbsenceInput): Promise<EmployeeAbsence | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<EmployeeAbsence>(`/org/${orgId}/employee-absences`, data);
        setSuccessMessage(
          'Afastamento registrado. A folha deste mes sera ajustada automaticamente.',
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar afastamento';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const registerReturn = useCallback(
    async (absenceId: string, data: RegisterReturnInput): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.patch(`/org/${orgId}/employee-absences/${absenceId}/return`, data);
        setSuccessMessage('Retorno registrado com sucesso.');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar retorno';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const updateAbsence = useCallback(
    async (
      absenceId: string,
      data: Partial<CreateAbsenceInput>,
    ): Promise<EmployeeAbsence | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.patch<EmployeeAbsence>(
          `/org/${orgId}/employee-absences/${absenceId}`,
          data,
        );
        setSuccessMessage('Afastamento atualizado com sucesso.');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar afastamento';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  return {
    absences,
    loading,
    error,
    successMessage,
    fetchAbsences,
    createAbsence,
    registerReturn,
    updateAbsence,
  };
}
