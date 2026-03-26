import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { ComplianceSummary, EmployeeCompliance } from '@/types/safety';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ComplianceDashboardQuery {
  farmId?: string;
  pendingType?: 'EPI' | 'TREINAMENTO' | 'ASO';
  search?: string;
  page?: number;
  limit?: number;
}

interface PaginatedEmployees {
  data: EmployeeCompliance[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSafetyCompliance() {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [employees, setEmployees] = useState<PaginatedEmployees | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // ─── Fetch Summary ─────────────────────────────────────────────────

  const fetchSummary = useCallback(async (farmId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
      const data = await api.get<ComplianceSummary>(`/org/safety-compliance/summary${qs}`);
      setSummary(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar resumo de conformidade');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch Non-Compliant Employees ────────────────────────────────

  const fetchNonCompliantEmployees = useCallback(async (query: ComplianceDashboardQuery = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.farmId) params.set('farmId', query.farmId);
      if (query.pendingType) params.set('pendingType', query.pendingType);
      if (query.search) params.set('search', query.search);
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const qs = params.toString();
      const data = await api.get<PaginatedEmployees>(
        `/org/safety-compliance/employees${qs ? `?${qs}` : ''}`,
      );
      setEmployees(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar colaboradores');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch Single Employee Compliance ─────────────────────────────

  const fetchEmployeeCompliance = useCallback(async (employeeId: string) => {
    const data = await api.get<EmployeeCompliance>(
      `/org/safety-compliance/employees/${employeeId}`,
    );
    return data;
  }, []);

  // ─── Export CSV ───────────────────────────────────────────────────

  const exportCsv = useCallback(async (farmId?: string) => {
    setExportingCsv(true);
    try {
      const qs = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
      const blob = await api.getBlob(`/org/safety-compliance/report/csv${qs}`);
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `conformidade-nr31-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar CSV');
    } finally {
      setExportingCsv(false);
    }
  }, []);

  // ─── Export PDF ───────────────────────────────────────────────────

  const exportPdf = useCallback(async (farmId?: string) => {
    setExportingPdf(true);
    try {
      const qs = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
      const blob = await api.getBlob(`/org/safety-compliance/report/pdf${qs}`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after a delay to allow the tab to load
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar PDF');
    } finally {
      setExportingPdf(false);
    }
  }, []);

  return {
    summary,
    employees,
    loading,
    error,
    exportingCsv,
    exportingPdf,
    fetchSummary,
    fetchNonCompliantEmployees,
    fetchEmployeeCompliance,
    exportCsv,
    exportPdf,
  };
}
