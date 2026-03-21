import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

interface AnimalOwnerOption {
  id: string;
  name: string;
  document: string | null;
  type: string;
}

export function useAnimalOwners(farmId: string | undefined) {
  const [owners, setOwners] = useState<AnimalOwnerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOwners = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const data = await api.get<AnimalOwnerOption[]>(`/org/farms/${id}/animal-owners`);
      setOwners(data);
    } catch {
      setOwners([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!farmId) return;
    void fetchOwners(farmId);
  }, [farmId, fetchOwners]);

  const refetch = useCallback(() => {
    if (farmId) void fetchOwners(farmId);
  }, [farmId, fetchOwners]);

  return { owners: farmId ? owners : [], isLoading, refetch };
}
