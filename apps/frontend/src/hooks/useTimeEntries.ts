import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { TimeEntry, CreateTimeEntryInput, AddActivityInput } from '@/types/attendance';

interface TimeEntriesQuery {
  farmId?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

interface UseTimeEntriesResult {
  timeEntries: TimeEntry[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  fetchTimeEntries: (query?: TimeEntriesQuery) => Promise<void>;
  createTimeEntry: (employeeId: string, data: CreateTimeEntryInput) => Promise<boolean>;
  addActivity: (timeEntryId: string, data: AddActivityInput) => Promise<boolean>;
}

export function useTimeEntries(): UseTimeEntriesResult {
  const { user } = useAuth();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchTimeEntries = useCallback(
    async (query: TimeEntriesQuery = {}) => {
      const orgId = user?.organizationId;
      if (!orgId) return;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.farmId) params.set('farmId', query.farmId);
        if (query.employeeId) params.set('employeeId', query.employeeId);
        if (query.dateFrom) params.set('dateFrom', query.dateFrom);
        if (query.dateTo) params.set('dateTo', query.dateTo);
        if (query.page) params.set('page', String(query.page));
        if (query.limit) params.set('limit', String(query.limit));

        const qs = params.toString();
        const path = `/org/${orgId}/time-entries${qs ? `?${qs}` : ''}`;
        const result = await api.get<TimeEntry[] | { data: TimeEntry[] }>(path);
        const entries = Array.isArray(result) ? result : (result as { data: TimeEntry[] }).data;
        setTimeEntries(entries);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar apontamentos';
        setError(message);
        setTimeEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.organizationId],
  );

  const createTimeEntry = useCallback(
    async (employeeId: string, data: CreateTimeEntryInput): Promise<boolean> => {
      const orgId = user?.organizationId;
      if (!orgId) return false;

      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/employees/${employeeId}/time-entries`, data);
        setSuccessMessage('Ponto registrado com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar ponto';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.organizationId],
  );

  const addActivity = useCallback(
    async (timeEntryId: string, data: AddActivityInput): Promise<boolean> => {
      const orgId = user?.organizationId;
      if (!orgId) return false;

      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/time-entries/${timeEntryId}/activities`, data);
        setSuccessMessage('Atividade vinculada com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao vincular atividade';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.organizationId],
  );

  return {
    timeEntries,
    loading,
    error,
    successMessage,
    fetchTimeEntries,
    createTimeEntry,
    addActivity,
  };
}
