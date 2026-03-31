import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface ProductClassItem {
  id: string;
  name: string;
  description: string | null;
}

interface UseProductClassesResult {
  productClasses: ProductClassItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createProductClass: (name: string, description?: string) => Promise<ProductClassItem>;
}

export function useProductClasses(): UseProductClassesResult {
  const [productClasses, setProductClasses] = useState<ProductClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProductClasses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<ProductClassItem[]>('/org/product-classes');
      setProductClasses(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar classes de produto');
      setProductClasses([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProductClasses();
  }, [fetchProductClasses]);

  const createProductClass = useCallback(
    async (name: string, description?: string): Promise<ProductClassItem> => {
      const item = await api.post<ProductClassItem>('/org/product-classes', { name, description });
      setProductClasses((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      return item;
    },
    [],
  );

  return {
    productClasses,
    isLoading,
    error,
    refetch: fetchProductClasses,
    createProductClass,
  };
}
