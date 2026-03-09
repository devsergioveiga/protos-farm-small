import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { MonitoringReportResponse } from '@/types/monitoring-report';

interface UseMonitoringReportParams {
  farmId: string;
}

interface UseMonitoringReportResult {
  report: MonitoringReportResponse | null;
  isLoading: boolean;
  error: string | null;
  generateReport: (startDate: string, endDate: string, fieldPlotIds?: string) => Promise<void>;
  downloadExcel: (startDate: string, endDate: string, fieldPlotIds?: string) => void;
}

export function useMonitoringReport(params: UseMonitoringReportParams): UseMonitoringReportResult {
  const [report, setReport] = useState<MonitoringReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { farmId } = params;

  const generateReport = useCallback(
    async (startDate: string, endDate: string, fieldPlotIds?: string) => {
      if (!farmId) return;
      setIsLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams();
        query.set('startDate', startDate);
        query.set('endDate', endDate);
        if (fieldPlotIds) query.set('fieldPlotIds', fieldPlotIds);

        const path = `/org/farms/${farmId}/monitoring-report?${query.toString()}`;
        const result = await api.get<MonitoringReportResponse>(path);
        setReport(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao gerar relatório';
        setError(message);
        setReport(null);
      } finally {
        setIsLoading(false);
      }
    },
    [farmId],
  );

  const downloadExcel = useCallback(
    (startDate: string, endDate: string, fieldPlotIds?: string) => {
      if (!farmId) return;
      const query = new URLSearchParams();
      query.set('startDate', startDate);
      query.set('endDate', endDate);
      if (fieldPlotIds) query.set('fieldPlotIds', fieldPlotIds);

      const token = localStorage.getItem('accessToken');
      const baseUrl = '/api';
      const url = `${baseUrl}/org/farms/${farmId}/monitoring-report/excel?${query.toString()}`;

      // Use a hidden link with token in header via fetch
      fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error('Erro ao baixar relatório');
          return res.blob();
        })
        .then((blob) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          const disposition = `relatorio-mip-${new Date().toISOString().split('T')[0]}.xlsx`;
          a.download = disposition;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
        })
        .catch(() => {
          setError('Erro ao baixar o relatório Excel');
        });
    },
    [farmId],
  );

  return { report, isLoading, error, generateReport, downloadExcel };
}
