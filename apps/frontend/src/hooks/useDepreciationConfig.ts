import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  DepreciationConfig,
  CreateDepreciationConfigInput,
  UpdateDepreciationConfigInput,
} from '@/types/depreciation';

// ─── useDepreciationConfig ────────────────────────────────────────────────────

export function useDepreciationConfig(assetId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [config, setConfig] = useState<DepreciationConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!orgId || !assetId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<DepreciationConfig | null>(
        `/org/${orgId}/depreciation/config/${assetId}`,
      );
      setConfig(result);
    } catch {
      setError('Nao foi possivel carregar a configuracao de depreciacao.');
    } finally {
      setLoading(false);
    }
  }, [orgId, assetId]);

  const createConfig = useCallback(
    async (data: CreateDepreciationConfigInput): Promise<DepreciationConfig> => {
      if (!orgId) throw new Error('Organizacao nao identificada.');
      const result = await api.post<DepreciationConfig>(`/org/${orgId}/depreciation/config`, data);
      setConfig(result);
      return result;
    },
    [orgId],
  );

  const updateConfig = useCallback(
    async (
      targetAssetId: string,
      data: UpdateDepreciationConfigInput,
    ): Promise<DepreciationConfig> => {
      if (!orgId) throw new Error('Organizacao nao identificada.');
      const result = await api.patch<DepreciationConfig>(
        `/org/${orgId}/depreciation/config/${targetAssetId}`,
        data,
      );
      setConfig(result);
      return result;
    },
    [orgId],
  );

  const removeConfig = useCallback(
    async (targetAssetId: string): Promise<void> => {
      if (!orgId) throw new Error('Organizacao nao identificada.');
      await api.delete<void>(`/org/${orgId}/depreciation/config/${targetAssetId}`);
      setConfig(null);
    },
    [orgId],
  );

  const refetch = useCallback(() => {
    void fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, fetchConfig, createConfig, updateConfig, removeConfig, refetch };
}
