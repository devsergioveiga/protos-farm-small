import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { CreateTransferInput, TransferOutput } from '@/types/asset';

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAssetTransfer() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferOutput[]>([]);

  const createTransfer = useCallback(
    async (assetId: string, data: CreateTransferInput): Promise<TransferOutput> => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.post<TransferOutput>(
          `/org/${orgId}/asset-farm-transfers/${assetId}/transfer`,
          data,
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel registrar a transferencia. Verifique os dados e tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  const listTransfers = useCallback(
    async (assetId: string): Promise<TransferOutput[]> => {
      if (!orgId) return [];
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.get<TransferOutput[]>(
          `/org/${orgId}/asset-farm-transfers/${assetId}/transfers`,
        );
        setTransfers(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel carregar o historico de transferencias.';
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return {
    createTransfer,
    listTransfers,
    transfers,
    isLoading,
    error,
  };
}
