import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { Asset, AssetSummary, AssetListResponse, ListAssetsQuery } from '@/types/asset';

// ─── useAssets ────────────────────────────────────────────────────────

interface UseAssetsState {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  summary: AssetSummary | null;
  total: number;
  page: number;
  totalPages: number;
}

export function useAssets() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [state, setState] = useState<UseAssetsState>({
    assets: [],
    loading: false,
    error: null,
    summary: null,
    total: 0,
    page: 1,
    totalPages: 1,
  });

  const fetchAssets = useCallback(
    async (query: ListAssetsQuery = {}) => {
      if (!orgId) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const qs = new URLSearchParams();
        if (query.page) qs.set('page', String(query.page));
        if (query.limit) qs.set('limit', String(query.limit));
        if (query.farmId) qs.set('farmId', query.farmId);
        if (query.assetType) qs.set('assetType', query.assetType);
        if (query.status) qs.set('status', query.status);
        if (query.search) qs.set('search', query.search);
        if (query.minValue) qs.set('minValue', query.minValue);
        if (query.maxValue) qs.set('maxValue', query.maxValue);
        if (query.acquisitionFrom) qs.set('acquisitionFrom', query.acquisitionFrom);
        if (query.acquisitionTo) qs.set('acquisitionTo', query.acquisitionTo);

        const result = await api.get<AssetListResponse>(
          `/org/${orgId}/assets${qs.toString() ? `?${qs.toString()}` : ''}`,
        );
        setState((prev) => ({
          ...prev,
          assets: result.data,
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          loading: false,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Nao foi possivel carregar os ativos. Verifique sua conexao e tente novamente.',
          assets: [],
        }));
      }
    },
    [orgId],
  );

  const fetchSummary = useCallback(async () => {
    if (!orgId) return;
    try {
      const result = await api.get<AssetSummary>(`/org/${orgId}/assets/summary`);
      setState((prev) => ({ ...prev, summary: result }));
    } catch {
      // Summary failure is non-critical — keep existing summary
    }
  }, [orgId]);

  const deleteAsset = useCallback(
    async (id: string, currentQuery: ListAssetsQuery = {}) => {
      if (!orgId) return;
      await api.delete(`/org/${orgId}/assets/${id}`);
      await Promise.all([fetchAssets(currentQuery), fetchSummary()]);
    },
    [orgId, fetchAssets, fetchSummary],
  );

  const exportCsv = useCallback(
    async (query: ListAssetsQuery = {}) => {
      if (!orgId) return;
      const qs = new URLSearchParams();
      if (query.farmId) qs.set('farmId', query.farmId);
      if (query.assetType) qs.set('assetType', query.assetType);
      if (query.status) qs.set('status', query.status);
      if (query.search) qs.set('search', query.search);
      if (query.acquisitionFrom) qs.set('acquisitionFrom', query.acquisitionFrom);
      if (query.acquisitionTo) qs.set('acquisitionTo', query.acquisitionTo);

      const blob = await api.getBlob(
        `/org/${orgId}/assets/export/csv${qs.toString() ? `?${qs.toString()}` : ''}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ativos.csv';
      a.click();
      URL.revokeObjectURL(url);
    },
    [orgId],
  );

  const exportPdf = useCallback(
    async (query: ListAssetsQuery = {}) => {
      if (!orgId) return;
      const qs = new URLSearchParams();
      if (query.farmId) qs.set('farmId', query.farmId);
      if (query.assetType) qs.set('assetType', query.assetType);
      if (query.status) qs.set('status', query.status);
      if (query.search) qs.set('search', query.search);
      if (query.acquisitionFrom) qs.set('acquisitionFrom', query.acquisitionFrom);
      if (query.acquisitionTo) qs.set('acquisitionTo', query.acquisitionTo);

      const blob = await api.getBlob(
        `/org/${orgId}/assets/export/pdf${qs.toString() ? `?${qs.toString()}` : ''}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ativos.pdf';
      a.click();
      URL.revokeObjectURL(url);
    },
    [orgId],
  );

  return {
    ...state,
    fetchAssets,
    fetchSummary,
    deleteAsset,
    exportCsv,
    exportPdf,
  };
}
