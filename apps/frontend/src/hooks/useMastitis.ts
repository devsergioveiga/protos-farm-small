import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { MastitisCaseItem, MastitisListResponse, MastitisIndicators } from '@/types/mastitis';

/* ─── List hook ──────────────────────────────────────────────────── */

interface UseMastitisParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  status?: string;
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseMastitisResult {
  cases: MastitisCaseItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMastitis(params: UseMastitisParams): UseMastitisResult {
  const [cases, setCases] = useState<MastitisCaseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, status, animalId, dateFrom, dateTo } = params;

  const fetchCases = useCallback(async () => {
    if (!farmId) {
      setCases([]);
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
      if (status) query.set('status', status);
      if (animalId) query.set('animalId', animalId);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/mastitis-cases${qs ? `?${qs}` : ''}`;
      const result = await api.get<MastitisListResponse>(path);
      setCases(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar casos de mastite';
      setError(message);
      setCases([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, status, animalId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  return { cases, total, isLoading, error, refetch: fetchCases };
}

/* ─── Indicators hook ────────────────────────────────────────────── */

interface UseMastitisIndicatorsResult {
  indicators: MastitisIndicators | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMastitisIndicators(farmId: string | null): UseMastitisIndicatorsResult {
  const [indicators, setIndicators] = useState<MastitisIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIndicators = useCallback(async () => {
    if (!farmId) {
      setIndicators(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<MastitisIndicators>(
        `/org/farms/${farmId}/mastitis-cases/indicators`,
      );
      setIndicators(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar indicadores';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchIndicators();
  }, [fetchIndicators]);

  return { indicators, isLoading, error, refetch: fetchIndicators };
}

/* ─── Detail hook ────────────────────────────────────────────────── */

interface UseMastitisDetailResult {
  mastitisCase: MastitisCaseItem | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMastitisDetail(
  farmId: string | null,
  caseId: string | null,
): UseMastitisDetailResult {
  const [mastitisCase, setMastitisCase] = useState<MastitisCaseItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!farmId || !caseId) {
      setMastitisCase(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<MastitisCaseItem>(
        `/org/farms/${farmId}/mastitis-cases/${caseId}`,
      );
      setMastitisCase(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar caso';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, caseId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  return { mastitisCase, isLoading, error, refetch: fetchDetail };
}
