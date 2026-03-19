import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { Asset } from '@/types/asset';

// ─── useAssetDetail ───────────────────────────────────────────────────

export function useAssetDetail(assetId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAsset = useCallback(async () => {
    if (!orgId || !assetId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<Asset>(`/org/${orgId}/assets/${assetId}`);
      setAsset(result);
    } catch {
      setError('Nao foi possivel carregar os dados deste ativo. Volte e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [orgId, assetId]);

  useEffect(() => {
    if (assetId) {
      void fetchAsset();
    } else {
      setAsset(null);
      setError(null);
    }
  }, [assetId, fetchAsset]);

  const refetch = useCallback(() => {
    void fetchAsset();
  }, [fetchAsset]);

  return { asset, loading, error, refetch };
}
