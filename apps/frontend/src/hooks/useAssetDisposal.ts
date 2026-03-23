import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { CreateDisposalInput, DisposalOutput } from '@/types/asset';

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAssetDisposal() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDisposal = useCallback(
    async (assetId: string, data: CreateDisposalInput): Promise<DisposalOutput> => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.post<DisposalOutput>(
          `/org/${orgId}/asset-disposals/${assetId}/dispose`,
          data,
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel registrar a alienacao. Verifique os dados e tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  const getDisposal = useCallback(
    async (assetId: string): Promise<DisposalOutput | null> => {
      if (!orgId) return null;
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.get<DisposalOutput>(
          `/org/${orgId}/asset-disposals/${assetId}/disposal`,
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Nao foi possivel carregar os dados da alienacao.';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return {
    createDisposal,
    getDisposal,
    isLoading,
    error,
  };
}
