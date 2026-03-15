import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  NaturalMatingItem,
  NaturalMatingsResponse,
  NaturalMatingDetail,
  OverstayAlert,
  MatingIndicators,
} from '@/types/natural-mating';

interface UseNaturalMatingsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
}

interface UseNaturalMatingsResult {
  matings: NaturalMatingItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useNaturalMatings(params: UseNaturalMatingsParams): UseNaturalMatingsResult {
  const [matings, setMatings] = useState<NaturalMatingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit } = params;

  const fetchMatings = useCallback(async () => {
    if (!farmId) {
      setMatings([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));

      const qs = query.toString();
      const path = `/org/farms/${farmId}/natural-matings${qs ? `?${qs}` : ''}`;
      const result = await api.get<NaturalMatingsResponse>(path);
      setMatings(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar montas naturais';
      setError(message);
      setMatings([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit]);

  useEffect(() => {
    void fetchMatings();
  }, [fetchMatings]);

  return { matings, total, isLoading, error, refetch: fetchMatings };
}

export function useOverstayAlerts(farmId: string | null) {
  const [alerts, setAlerts] = useState<OverstayAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!farmId) {
      setAlerts([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<OverstayAlert[]>(
        `/org/farms/${farmId}/natural-matings/overstay-alerts`,
      );
      setAlerts(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar alertas de permanencia';
      setError(message);
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, isLoading, error, refetch: fetchAlerts };
}

export function useMatingIndicators(farmId: string | null) {
  const [indicators, setIndicators] = useState<MatingIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIndicators = useCallback(async () => {
    if (!farmId) {
      setIndicators(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<MatingIndicators>(
        `/org/farms/${farmId}/natural-matings/indicators`,
      );
      setIndicators(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar indicadores';
      setError(message);
      setIndicators(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchIndicators();
  }, [fetchIndicators]);

  return { indicators, isLoading, error, refetch: fetchIndicators };
}

export function useMatingDetail(farmId: string | null, matingId: string | null) {
  const [detail, setDetail] = useState<NaturalMatingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!farmId || !matingId) {
      setDetail(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<NaturalMatingDetail>(
        `/org/farms/${farmId}/natural-matings/${matingId}`,
      );
      setDetail(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar detalhes da monta';
      setError(message);
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, matingId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  return { detail, isLoading, error, refetch: fetchDetail };
}
