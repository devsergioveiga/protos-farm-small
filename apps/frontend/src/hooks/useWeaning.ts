import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  SeparationItem,
  SeparationsResponse,
  WeaningCandidateItem,
  WeaningItem,
  WeaningsResponse,
  WeaningIndicators,
  WeaningCriteria,
} from '@/types/weaning';
import type { PaginationMeta } from '@/types/admin';

/* ─── useSeparations ─────────────────────────────────────────────── */

interface UseSeparationsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  search?: string;
}

interface UseSeparationsResult {
  separations: SeparationItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSeparations(params: UseSeparationsParams): UseSeparationsResult {
  const [separations, setSeparations] = useState<SeparationItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, search } = params;

  const fetch = useCallback(async () => {
    if (!farmId) {
      setSeparations([]);
      setMeta(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (search) query.set('search', search);
      const qs = query.toString();
      const path = `/org/farms/${farmId}/calf-separations${qs ? `?${qs}` : ''}`;
      const result = await api.get<SeparationsResponse>(path);
      setSeparations(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar separações';
      setError(message);
      setSeparations([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, search]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { separations, meta, isLoading, error, refetch: fetch };
}

/* ─── useWeaningCandidates ───────────────────────────────────────── */

interface UseWeaningCandidatesParams {
  farmId: string | null;
}

interface UseWeaningCandidatesResult {
  candidates: WeaningCandidateItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWeaningCandidates(
  params: UseWeaningCandidatesParams,
): UseWeaningCandidatesResult {
  const [candidates, setCandidates] = useState<WeaningCandidateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId } = params;

  const fetch = useCallback(async () => {
    if (!farmId) {
      setCandidates([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<{ data: WeaningCandidateItem[] }>(
        `/org/farms/${farmId}/weanings/candidates`,
      );
      setCandidates(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar candidatos';
      setError(message);
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { candidates, isLoading, error, refetch: fetch };
}

/* ─── useWeanings ────────────────────────────────────────────────── */

interface UseWeaningsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  search?: string;
}

interface UseWeaningsResult {
  weanings: WeaningItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWeanings(params: UseWeaningsParams): UseWeaningsResult {
  const [weanings, setWeanings] = useState<WeaningItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, search } = params;

  const fetch = useCallback(async () => {
    if (!farmId) {
      setWeanings([]);
      setMeta(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (search) query.set('search', search);
      const qs = query.toString();
      const path = `/org/farms/${farmId}/weanings${qs ? `?${qs}` : ''}`;
      const result = await api.get<WeaningsResponse>(path);
      setWeanings(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar desmamas';
      setError(message);
      setWeanings([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, search]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { weanings, meta, isLoading, error, refetch: fetch };
}

/* ─── useWeaningIndicators ───────────────────────────────────────── */

interface UseWeaningIndicatorsParams {
  farmId: string | null;
}

interface UseWeaningIndicatorsResult {
  indicators: WeaningIndicators | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWeaningIndicators(
  params: UseWeaningIndicatorsParams,
): UseWeaningIndicatorsResult {
  const [indicators, setIndicators] = useState<WeaningIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId } = params;

  const fetch = useCallback(async () => {
    if (!farmId) {
      setIndicators(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<WeaningIndicators>(`/org/farms/${farmId}/weanings/indicators`);
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
    void fetch();
  }, [fetch]);

  return { indicators, isLoading, error, refetch: fetch };
}

/* ─── useWeaningCriteria ─────────────────────────────────────────── */

interface UseWeaningCriteriaResult {
  criteria: WeaningCriteria | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWeaningCriteria(): UseWeaningCriteriaResult {
  const [criteria, setCriteria] = useState<WeaningCriteria | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<WeaningCriteria>('/org/weaning-criteria');
      setCriteria(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar critérios';
      setError(message);
      setCriteria(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { criteria, isLoading, error, refetch: fetch };
}
