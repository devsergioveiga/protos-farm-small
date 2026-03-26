import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  PayrollProvision,
  ProvisionReportRow,
  CalculateProvisionsResult,
  CalculateProvisionsInput,
} from '@/types/provision';

interface FetchProvisionsFilters {
  referenceMonth?: string;
  provisionType?: string;
  employeeSearch?: string;
}

export function usePayrollProvisions() {
  const { user } = useAuth();
  const [provisions, setProvisions] = useState<PayrollProvision[]>([]);
  const [report, setReport] = useState<ProvisionReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const fetchProvisions = useCallback(
    async (filters?: FetchProvisionsFilters) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.referenceMonth) params.set('month', filters.referenceMonth);
        if (filters?.provisionType) params.set('provisionType', filters.provisionType);
        if (filters?.employeeSearch) params.set('search', filters.employeeSearch);
        const qs = params.toString();
        const path = `/org/${orgId}/payroll-provisions${qs ? `?${qs}` : ''}`;
        const result = await api.get<PayrollProvision[] | { data: PayrollProvision[] }>(path);
        const items = Array.isArray(result) ? result : (result as { data: PayrollProvision[] }).data;
        setProvisions(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Nao foi possivel carregar os dados. Verifique sua conexao e tente novamente.';
        setError(message);
        setProvisions([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const calculateProvisions = useCallback(
    async (data: CalculateProvisionsInput): Promise<CalculateProvisionsResult | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<CalculateProvisionsResult>(
          `/org/${orgId}/payroll-provisions/calculate`,
          data,
        );
        setSuccessMessage(`Provisoes de ${data.referenceMonth} calculadas para ${result.processedCount} colaboradores.`);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao calcular provisoes';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const reverseProvision = useCallback(
    async (provisionId: string): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.patch(`/org/${orgId}/payroll-provisions/${provisionId}/reverse`, {});
        setSuccessMessage('Provisao estornada com sucesso.');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao estornar provisao';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const fetchReport = useCallback(
    async (referenceMonth: string): Promise<void> => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await api.get<ProvisionReportRow[] | { data: ProvisionReportRow[] }>(
          `/org/${orgId}/payroll-provisions/report?month=${referenceMonth}`,
        );
        const items = Array.isArray(result) ? result : (result as { data: ProvisionReportRow[] }).data;
        setReport(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar relatorio de provisoes';
        setError(message);
        setReport([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const exportReport = useCallback(
    async (referenceMonth: string): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(
          `/org/${orgId}/payroll-provisions/report/export?month=${referenceMonth}`,
        );
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `provisoes-${referenceMonth}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao exportar relatorio';
        setError(message);
      }
    },
    [orgId],
  );

  return {
    provisions,
    report,
    loading,
    error,
    successMessage,
    fetchProvisions,
    calculateProvisions,
    reverseProvision,
    fetchReport,
    exportReport,
  };
}
