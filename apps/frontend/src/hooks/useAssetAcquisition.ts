import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  AssetAcquisitionInput,
  AssetAcquisitionOutput,
  NfeParsedData,
  CreateFromNfeInput,
  NfeAcquisitionOutput,
} from '@/types/asset';

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAssetAcquisition() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAcquisition = useCallback(
    async (input: AssetAcquisitionInput): Promise<AssetAcquisitionOutput> => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.post<AssetAcquisitionOutput>(
          `/org/${orgId}/asset-acquisitions`,
          input,
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel registrar a aquisicao. Verifique os dados e tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  const parseNfe = useCallback(
    async (file: File): Promise<NfeParsedData> => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      setIsLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const result = await api.postFormData<NfeParsedData>(
          `/org/${orgId}/asset-acquisitions/parse-nfe`,
          formData,
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel processar a NF-e. Verifique o arquivo e tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  const createFromNfe = useCallback(
    async (nfeParsed: NfeParsedData, input: CreateFromNfeInput): Promise<NfeAcquisitionOutput> => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.post<NfeAcquisitionOutput>(
          `/org/${orgId}/asset-acquisitions/from-nfe`,
          { ...input, nfeParsed },
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel criar o ativo a partir da NF-e. Tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return {
    createAcquisition,
    parseNfe,
    createFromNfe,
    isLoading,
    error,
  };
}
