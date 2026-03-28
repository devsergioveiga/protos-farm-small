import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { Timesheet } from '@/types/attendance';

interface TimesheetQuery {
  farmId?: string;
  employeeId?: string;
  referenceMonth?: string;
  status?: string;
  page?: number;
  limit?: number;
}

interface ApproveTimesheetInput {
  action: 'APPROVE_MANAGER' | 'APPROVE_RH' | 'REJECT';
  justification?: string;
}

interface AddCorrectionInput {
  timeEntryId?: string;
  justification: string;
  beforeJson: Record<string, unknown>;
  afterJson: Record<string, unknown>;
}

interface UseTimesheetResult {
  timesheets: Timesheet[];
  timesheet: Timesheet | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  fetchTimesheets: (query?: TimesheetQuery) => Promise<void>;
  fetchTimesheet: (id: string) => Promise<void>;
  calculateTimesheet: (id: string) => Promise<boolean>;
  approveTimesheet: (id: string, data: ApproveTimesheetInput) => Promise<boolean>;
  addCorrection: (id: string, data: AddCorrectionInput) => Promise<boolean>;
  exportPdf: (id: string) => Promise<void>;
}

export function useTimesheet(): UseTimesheetResult {
  const { user } = useAuth();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchTimesheets = useCallback(
    async (query: TimesheetQuery = {}) => {
      const orgId = user?.organizationId;
      if (!orgId) return;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.farmId) params.set('farmId', query.farmId);
        if (query.employeeId) params.set('employeeId', query.employeeId);
        if (query.referenceMonth) params.set('referenceMonth', query.referenceMonth);
        if (query.status) params.set('status', query.status);
        if (query.page) params.set('page', String(query.page));
        if (query.limit) params.set('limit', String(query.limit));

        const qs = params.toString();
        const path = `/org/${orgId}/timesheets${qs ? `?${qs}` : ''}`;
        const result = await api.get<Timesheet[] | { data: Timesheet[] }>(path);
        const items = Array.isArray(result) ? result : (result as { data: Timesheet[] }).data;
        setTimesheets(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar espelhos de ponto';
        setError(message);
        setTimesheets([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.organizationId],
  );

  const fetchTimesheet = useCallback(
    async (id: string) => {
      const orgId = user?.organizationId;
      if (!orgId) return;

      setLoading(true);
      setError(null);
      try {
        const result = await api.get<Timesheet>(`/org/${orgId}/timesheets/${id}`);
        setTimesheet(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar espelho de ponto';
        setError(message);
        setTimesheet(null);
      } finally {
        setLoading(false);
      }
    },
    [user?.organizationId],
  );

  const calculateTimesheet = useCallback(
    async (id: string): Promise<boolean> => {
      const orgId = user?.organizationId;
      if (!orgId) return false;

      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/timesheets/${id}/calculate`, {});
        setSuccessMessage('Espelho calculado com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao calcular espelho';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.organizationId],
  );

  const approveTimesheet = useCallback(
    async (id: string, data: ApproveTimesheetInput): Promise<boolean> => {
      const orgId = user?.organizationId;
      if (!orgId) return false;

      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.patch(`/org/${orgId}/timesheets/${id}/approve`, data);
        setSuccessMessage('Espelho atualizado com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao aprovar espelho';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.organizationId],
  );

  const addCorrection = useCallback(
    async (id: string, data: AddCorrectionInput): Promise<boolean> => {
      const orgId = user?.organizationId;
      if (!orgId) return false;

      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/timesheets/${id}/corrections`, data);
        setSuccessMessage('Correção registrada com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar correção';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.organizationId],
  );

  const exportPdf = useCallback(
    async (id: string): Promise<void> => {
      const orgId = user?.organizationId;
      if (!orgId) return;

      try {
        const blob = await api.getBlob(`/org/${orgId}/timesheets/${id}/pdf`);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `espelho-ponto-${id}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao exportar PDF';
        setError(message);
      }
    },
    [user?.organizationId],
  );

  return {
    timesheets,
    timesheet,
    loading,
    error,
    successMessage,
    fetchTimesheets,
    fetchTimesheet,
    calculateTimesheet,
    approveTimesheet,
    addCorrection,
    exportPdf,
  };
}
