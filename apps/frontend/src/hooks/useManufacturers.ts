import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface ManufacturerItem {
  id: string;
  name: string;
  cnpj: string | null;
}

interface UseManufacturersResult {
  manufacturers: ManufacturerItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createManufacturer: (name: string, cnpj?: string) => Promise<ManufacturerItem>;
  updateManufacturer: (id: string, name: string, cnpj?: string) => Promise<ManufacturerItem>;
  deleteManufacturer: (id: string) => Promise<void>;
}

export function useManufacturers(): UseManufacturersResult {
  const [manufacturers, setManufacturers] = useState<ManufacturerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManufacturers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<ManufacturerItem[]>('/org/manufacturers');
      setManufacturers(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fabricantes');
      setManufacturers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchManufacturers();
  }, [fetchManufacturers]);

  const createManufacturer = useCallback(
    async (name: string, cnpj?: string): Promise<ManufacturerItem> => {
      const item = await api.post<ManufacturerItem>('/org/manufacturers', { name, cnpj });
      setManufacturers((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      return item;
    },
    [],
  );

  const updateManufacturer = useCallback(
    async (id: string, name: string, cnpj?: string): Promise<ManufacturerItem> => {
      const item = await api.put<ManufacturerItem>(`/org/manufacturers/${id}`, { name, cnpj });
      setManufacturers((prev) =>
        prev.map((m) => (m.id === id ? item : m)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      return item;
    },
    [],
  );

  const deleteManufacturer = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/org/manufacturers/${id}`);
    setManufacturers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return {
    manufacturers,
    isLoading,
    error,
    refetch: fetchManufacturers,
    createManufacturer,
    updateManufacturer,
    deleteManufacturer,
  };
}
