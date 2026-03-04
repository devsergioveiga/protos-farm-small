import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FarmProducerLink } from '@/types/farm-producer';

export function useFarmProducers(farmId: string | undefined) {
  const [producers, setProducers] = useState<FarmProducerLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducers = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<FarmProducerLink[]>(`/org/farms/${id}/producers`);
      setProducers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar produtores';
      setError(message);
      setProducers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!farmId) return;
    void fetchProducers(farmId);
  }, [farmId, fetchProducers]);

  const refetch = useCallback(() => {
    if (farmId) void fetchProducers(farmId);
  }, [farmId, fetchProducers]);

  return { producers: farmId ? producers : [], isLoading, error, refetch };
}
