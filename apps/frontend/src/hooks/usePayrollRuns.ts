import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { PayrollRun, PayrollRunType, WizardEmployeePreview } from '@/types/payroll-runs';

interface FetchRunsFilters {
  month?: string;
  type?: string;
  status?: string;
}

interface CreateRunInput {
  referenceMonth: string;
  runType: PayrollRunType;
  notes?: string;
}

export function usePayrollRuns() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const fetchRuns = useCallback(
    async (filters?: FetchRunsFilters) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.month) params.set('month', filters.month);
        if (filters?.type) params.set('type', filters.type);
        if (filters?.status) params.set('status', filters.status);
        const qs = params.toString();
        const path = `/org/${orgId}/payroll-runs${qs ? `?${qs}` : ''}`;
        const result = await api.get<PayrollRun[] | { data: PayrollRun[] }>(path);
        const items = Array.isArray(result) ? result : (result as { data: PayrollRun[] }).data;
        setRuns(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar folhas de pagamento';
        setError(message);
        setRuns([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const createRun = useCallback(
    async (data: CreateRunInput): Promise<PayrollRun | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<PayrollRun>(`/org/${orgId}/payroll-runs`, data);
        setSuccessMessage('Folha criada com sucesso');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar folha';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const processRun = useCallback(
    async (runId: string, employeeIds: string[]): Promise<PayrollRun | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<PayrollRun>(`/org/${orgId}/payroll-runs/${runId}/process`, {
          employeeIds,
        });
        setSuccessMessage('Folha processada com sucesso');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao processar folha';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const recalculateEmployee = useCallback(
    async (runId: string, employeeId: string): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/payroll-runs/${runId}/recalculate/${employeeId}`, {});
        setSuccessMessage('Colaborador recalculado com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao recalcular colaborador';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const closeRun = useCallback(
    async (runId: string): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/payroll-runs/${runId}/close`, {});
        setSuccessMessage('Folha fechada com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao fechar folha';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const revertRun = useCallback(
    async (runId: string): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/payroll-runs/${runId}/revert`, {});
        setSuccessMessage('Folha estornada com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao estornar folha';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const getRun = useCallback(
    async (runId: string): Promise<PayrollRun | null> => {
      if (!orgId) return null;
      try {
        return await api.get<PayrollRun>(`/org/${orgId}/payroll-runs/${runId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar folha';
        setError(message);
        return null;
      }
    },
    [orgId],
  );

  const getPreview = useCallback(
    async (runId: string): Promise<WizardEmployeePreview[]> => {
      if (!orgId) return [];
      try {
        const result = await api.get<WizardEmployeePreview[] | { data: WizardEmployeePreview[] }>(
          `/org/${orgId}/payroll-runs/preview/${runId}`,
        );
        return Array.isArray(result) ? result : (result as { data: WizardEmployeePreview[] }).data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar preview';
        setError(message);
        return [];
      }
    },
    [orgId],
  );

  const downloadPayslips = useCallback(
    async (runId: string): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(`/org/${orgId}/payroll-runs/${runId}/payslips`);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `holerites-${runId}.zip`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao baixar holerites';
        setError(message);
      }
    },
    [orgId],
  );

  const downloadItemPayslip = useCallback(
    async (runId: string, itemId: string): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(
          `/org/${orgId}/payroll-runs/${runId}/items/${itemId}/payslip`,
        );
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `holerite-${itemId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao baixar holerite';
        setError(message);
      }
    },
    [orgId],
  );

  return {
    runs,
    loading,
    error,
    successMessage,
    fetchRuns,
    createRun,
    processRun,
    recalculateEmployee,
    closeRun,
    revertRun,
    getRun,
    getPreview,
    downloadPayslips,
    downloadItemPayslip,
  };
}
