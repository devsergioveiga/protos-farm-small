import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  EpiProduct,
  EpiProductsResponse,
  PositionEpiRequirement,
  PositionWithEpiCount,
  CreateEpiProductInput,
  UpdateEpiProductInput,
  CreatePositionEpiRequirementInput,
} from '@/types/epi';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useEpiProducts() {
  const [epiProducts, setEpiProducts] = useState<EpiProductsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── EPI Products ────────────────────────────────────────────────────

  const fetchEpiProducts = useCallback(
    async (params?: {
      search?: string;
      epiType?: string;
      page?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (params?.search) qs.set('search', params.search);
        if (params?.epiType) qs.set('epiType', params.epiType);
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));

        const query = qs.toString();
        const data = await api.get<EpiProductsResponse>(
          `/org/epi-products${query ? `?${query}` : ''}`,
        );
        setEpiProducts(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createEpiProduct = useCallback(async (input: CreateEpiProductInput): Promise<EpiProduct> => {
    const data = await api.post<EpiProduct>('/org/epi-products', input);
    setSuccessMessage('EPI cadastrado com sucesso.');
    return data;
  }, []);

  const updateEpiProduct = useCallback(
    async (id: string, input: UpdateEpiProductInput): Promise<EpiProduct> => {
      const data = await api.put<EpiProduct>(`/org/epi-products/${id}`, input);
      setSuccessMessage('EPI atualizado com sucesso.');
      return data;
    },
    [],
  );

  const deleteEpiProduct = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/org/epi-products/${id}`);
    setSuccessMessage('EPI removido.');
  }, []);

  // ─── Position Requirements ───────────────────────────────────────────

  const fetchPositionRequirements = useCallback(async (): Promise<PositionWithEpiCount[]> => {
    const data = await api.get<PositionWithEpiCount[]>('/org/epi-products/position-requirements');
    return data;
  }, []);

  const fetchRequirementsForPosition = useCallback(
    async (positionId: string): Promise<PositionEpiRequirement[]> => {
      const data = await api.get<PositionEpiRequirement[]>(
        `/org/epi-products/position-requirements/${positionId}`,
      );
      return data;
    },
    [],
  );

  const createPositionRequirement = useCallback(
    async (input: CreatePositionEpiRequirementInput): Promise<PositionEpiRequirement> => {
      const data = await api.post<PositionEpiRequirement>(
        '/org/epi-products/position-requirements',
        input,
      );
      return data;
    },
    [],
  );

  const deletePositionRequirement = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/org/epi-products/position-requirements/${id}`);
  }, []);

  return {
    epiProducts,
    loading,
    error,
    successMessage,
    setSuccessMessage,
    fetchEpiProducts,
    createEpiProduct,
    updateEpiProduct,
    deleteEpiProduct,
    fetchPositionRequirements,
    fetchRequirementsForPosition,
    createPositionRequirement,
    deletePositionRequirement,
  };
}
