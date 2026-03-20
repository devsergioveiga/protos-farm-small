import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { DepreciationReportResponse, DepreciationTrack } from '@/types/depreciation';

// ─── useDepreciationReport ────────────────────────────────────────────────────

export function useDepreciationReport() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [data, setData] = useState<DepreciationReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (
      periodYear: number,
      periodMonth: number,
      track?: DepreciationTrack,
      assetId?: string,
      page = 1,
      limit = 20,
    ): Promise<void> => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          periodYear: String(periodYear),
          periodMonth: String(periodMonth),
          page: String(page),
          limit: String(limit),
        });
        if (track) params.set('track', track);
        if (assetId) params.set('assetId', assetId);

        const result = await api.get<DepreciationReportResponse>(
          `/org/${orgId}/depreciation/report?${params.toString()}`,
        );
        setData(result);
      } catch {
        setError('Nao foi possivel carregar o relatorio de depreciacao.');
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const reverseEntry = useCallback(
    async (entryId: string): Promise<void> => {
      if (!orgId) throw new Error('Organizacao nao identificada.');
      await api.post<unknown>(`/org/${orgId}/depreciation/entries/${entryId}/reverse`);
    },
    [orgId],
  );

  const exportReport = useCallback(
    async (
      periodYear: number,
      periodMonth: number,
      track?: DepreciationTrack,
      format: 'csv' | 'xlsx' = 'csv',
    ): Promise<void> => {
      if (!orgId) return;

      const params = new URLSearchParams({
        periodYear: String(periodYear),
        periodMonth: String(periodMonth),
        format,
      });
      if (track) params.set('track', track);

      const blob = await api.getBlob(
        `/org/${orgId}/depreciation/report/export?${params.toString()}`,
      );

      const ext = format === 'xlsx' ? 'xlsx' : 'csv';
      const filename = `depreciacao-${periodYear}-${String(periodMonth).padStart(2, '0')}.${ext}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    },
    [orgId],
  );

  const refetch = useCallback(
    (
      periodYear: number,
      periodMonth: number,
      track?: DepreciationTrack,
      assetId?: string,
      page?: number,
      limit?: number,
    ) => {
      void fetchReport(periodYear, periodMonth, track, assetId, page, limit);
    },
    [fetchReport],
  );

  return { data, loading, error, fetchReport, reverseEntry, exportReport, refetch };
}
