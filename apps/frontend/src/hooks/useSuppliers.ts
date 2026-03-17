import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import type { Supplier, SuppliersListResponse } from '../types/supplier';

interface UseSupplierParams {
  search?: string;
  status?: string;
  category?: string;
  city?: string;
  state?: string;
  page?: number;
  limit?: number;
}

interface UseSupplierResult {
  suppliers: Supplier[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSuppliers(params: UseSupplierParams): UseSupplierResult {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, status, category, city, state, page = 1, limit = 20 } = params;

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set('search', search);
      if (status) queryParams.set('status', status);
      if (category) queryParams.set('category', category);
      if (city) queryParams.set('city', city);
      if (state) queryParams.set('state', state);
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));

      const result = await api.get<SuppliersListResponse>(
        `/org/suppliers?${queryParams.toString()}`,
      );
      setSuppliers(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fornecedores');
    } finally {
      setIsLoading(false);
    }
  }, [search, status, category, city, state, page, limit]);

  useEffect(() => {
    void fetchSuppliers();
  }, [fetchSuppliers]);

  return { suppliers, total, isLoading, error, refetch: fetchSuppliers };
}
