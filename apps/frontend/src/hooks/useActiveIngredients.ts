import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface ActiveIngredientItem {
  id: string;
  name: string;
  type: string;
  casNumber: string | null;
  notes: string | null;
}

interface UseActiveIngredientsResult {
  ingredients: ActiveIngredientItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createIngredient: (name: string, type?: string) => Promise<ActiveIngredientItem>;
}

export function useActiveIngredients(): UseActiveIngredientsResult {
  const [ingredients, setIngredients] = useState<ActiveIngredientItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIngredients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<ActiveIngredientItem[]>('/org/active-ingredients');
      setIngredients(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar princípios ativos');
      setIngredients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIngredients();
  }, [fetchIngredients]);

  const createIngredient = useCallback(
    async (name: string, type?: string): Promise<ActiveIngredientItem> => {
      const item = await api.post<ActiveIngredientItem>('/org/active-ingredients', { name, type });
      setIngredients((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      return item;
    },
    [],
  );

  return { ingredients, isLoading, error, refetch: fetchIngredients, createIngredient };
}
