import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  EpiProduct,
  PositionEpiRequirement,
  CreateEpiProductInput,
  UpdateEpiProductInput,
  CreatePositionEpiRequirementInput,
} from '@/types/epi';

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useEpiProducts() {
  const [epiProducts, setEpiProducts] = useState<PaginatedResult<EpiProduct> | null>(null);
  const [positionRequirements, setPositionRequirements] = useState<PositionEpiRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── EPI Products ────────────────────────────────────────────────

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
        const sp = new URLSearchParams();
        if (params?.search) sp.set('search', params.search);
        if (params?.epiType) sp.set('epiType', params.epiType);
        if (params?.page) sp.set('page', String(params.page));
        if (params?.limit) sp.set('limit', String(params.limit));
        const qs = sp.toString();
        const data = await api.get<PaginatedResult<EpiProduct>>(
          `/org/epi-products${qs ? `?${qs}` : ''}`,
        );
        setEpiProducts(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar EPIs');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createEpiProduct = useCallback(async (input: CreateEpiProductInput) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/org/epi-products', input);
      setSuccessMessage('EPI cadastrado com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar EPI');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEpiProduct = useCallback(async (id: string, input: UpdateEpiProductInput) => {
    setLoading(true);
    setError(null);
    try {
      await api.put(`/org/epi-products/${id}`, input);
      setSuccessMessage('EPI atualizado com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar EPI');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteEpiProduct = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/org/epi-products/${id}`);
      setSuccessMessage('EPI removido com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover EPI');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Position Requirements ───────────────────────────────────────

  const fetchPositionRequirements = useCallback(async (positionId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = positionId ? `?positionId=${positionId}` : '';
      const data = await api.get<PositionEpiRequirement[]>(
        `/org/epi-products/position-requirements${qs}`,
      );
      setPositionRequirements(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar requisitos');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPositionRequirement = useCallback(
    async (input: CreatePositionEpiRequirementInput) => {
      setLoading(true);
      setError(null);
      try {
        await api.post('/org/epi-products/position-requirements', input);
        setSuccessMessage('Requisito adicionado com sucesso.');
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao adicionar requisito');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deletePositionRequirement = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/org/epi-products/position-requirements/${id}`);
      setSuccessMessage('Requisito removido com sucesso.');
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover requisito');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    epiProducts,
    positionRequirements,
    loading,
    error,
    successMessage,
    fetchEpiProducts,
    createEpiProduct,
    updateEpiProduct,
    deleteEpiProduct,
    fetchPositionRequirements,
    createPositionRequirement,
    deletePositionRequirement,
  };
}
