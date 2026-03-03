import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { ProducerDetail } from '@/types/producer';

interface UseProducerDetailResult {
  producer: ProducerDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProducerDetail(producerId: string | null): UseProducerDetailResult {
  const [producer, setProducer] = useState<ProducerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducer = useCallback(async () => {
    if (!producerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<ProducerDetail>(`/org/producers/${producerId}`);
      setProducer(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar produtor';
      setError(message);
      setProducer(null);
    } finally {
      setIsLoading(false);
    }
  }, [producerId]);

  useEffect(() => {
    if (producerId) {
      void fetchProducer();
    } else {
      setProducer(null);
      setError(null);
    }
  }, [producerId, fetchProducer]);

  return { producer, isLoading, error, refetch: fetchProducer };
}
