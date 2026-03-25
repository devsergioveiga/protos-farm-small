import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  VacationAcquisitivePeriod,
  VacationSchedule,
  ScheduleVacationInput,
} from '@/types/vacation';

interface FetchPeriodsFilters {
  employeeSearch?: string;
}

interface FetchSchedulesFilters {
  employeeSearch?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export function useVacationSchedules() {
  const { user } = useAuth();
  const [periods, setPeriods] = useState<VacationAcquisitivePeriod[]>([]);
  const [schedules, setSchedules] = useState<VacationSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const fetchPeriods = useCallback(
    async (filters?: FetchPeriodsFilters) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.employeeSearch) params.set('search', filters.employeeSearch);
        const qs = params.toString();
        const path = `/org/${orgId}/vacation-periods${qs ? `?${qs}` : ''}`;
        const result = await api.get<VacationAcquisitivePeriod[] | { data: VacationAcquisitivePeriod[] }>(path);
        const items = Array.isArray(result) ? result : (result as { data: VacationAcquisitivePeriod[] }).data;
        setPeriods(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar periodos aquisitivos';
        setError(message);
        setPeriods([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const fetchSchedules = useCallback(
    async (filters?: FetchSchedulesFilters) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.employeeSearch) params.set('search', filters.employeeSearch);
        if (filters?.status) params.set('status', filters.status);
        if (filters?.startDate) params.set('startDate', filters.startDate);
        if (filters?.endDate) params.set('endDate', filters.endDate);
        const qs = params.toString();
        const path = `/org/${orgId}/vacation-schedules${qs ? `?${qs}` : ''}`;
        const result = await api.get<VacationSchedule[] | { data: VacationSchedule[] }>(path);
        const items = Array.isArray(result) ? result : (result as { data: VacationSchedule[] }).data;
        setSchedules(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar agendamentos de ferias';
        setError(message);
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const scheduleVacation = useCallback(
    async (data: ScheduleVacationInput): Promise<VacationSchedule | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<VacationSchedule>(`/org/${orgId}/vacation-schedules`, data);
        setSuccessMessage(`Ferias agendadas com sucesso. Pagamento deve ser realizado ate ${result.paymentDueDate}.`);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao agendar ferias';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const cancelVacation = useCallback(
    async (scheduleId: string): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.patch(`/org/${orgId}/vacation-schedules/${scheduleId}/cancel`, {});
        setSuccessMessage('Agendamento cancelado. Dias retornados ao saldo do colaborador.');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao cancelar agendamento';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const markAsPaid = useCallback(
    async (scheduleId: string): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.patch(`/org/${orgId}/vacation-schedules/${scheduleId}/pay`, {});
        setSuccessMessage('Ferias marcadas como pagas.');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao marcar ferias como pagas';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const fetchExpiring = useCallback(
    async (): Promise<VacationAcquisitivePeriod[]> => {
      if (!orgId) return [];
      try {
        const result = await api.get<VacationAcquisitivePeriod[] | { data: VacationAcquisitivePeriod[] }>(
          `/org/${orgId}/vacation-periods/expiring`,
        );
        return Array.isArray(result) ? result : (result as { data: VacationAcquisitivePeriod[] }).data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar ferias vencendo';
        setError(message);
        return [];
      }
    },
    [orgId],
  );

  const getReceiptPdf = useCallback(
    async (scheduleId: string, employeeName: string): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(`/org/${orgId}/vacation-schedules/${scheduleId}/receipt`);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recibo-ferias-${employeeName.replace(/\s+/g, '-')}.pdf`;
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
    periods,
    schedules,
    loading,
    error,
    successMessage,
    fetchPeriods,
    fetchSchedules,
    scheduleVacation,
    cancelVacation,
    markAsPaid,
    fetchExpiring,
    getReceiptPdf,
  };
}
