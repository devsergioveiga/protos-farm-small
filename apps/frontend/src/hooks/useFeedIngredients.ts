import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  FeedIngredientItem,
  FeedIngredientsResponse,
  AnalysisItem,
  AnalysesResponse,
  ComparisonItem,
  QualityTrendPoint,
} from '@/types/feed-ingredient';
import type { PaginationMeta } from '@/types/admin';

/* ─── List feed ingredients ─────────────────────────────────────────── */

interface UseFeedIngredientsParams {
  page?: number;
  limit?: number;
  type?: string;
  search?: string;
}

interface UseFeedIngredientsResult {
  ingredients: FeedIngredientItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFeedIngredients(params: UseFeedIngredientsParams): UseFeedIngredientsResult {
  const [ingredients, setIngredients] = useState<FeedIngredientItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, type, search } = params;

  const fetchIngredients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (type) query.set('type', type);

      const qs = query.toString();
      const path = `/org/feed-ingredients${qs ? `?${qs}` : ''}`;
      const result = await api.get<FeedIngredientsResponse>(path);
      setIngredients(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar ingredientes';
      setError(message);
      setIngredients([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, type, search]);

  useEffect(() => {
    void fetchIngredients();
  }, [fetchIngredients]);

  return { ingredients, meta, isLoading, error, refetch: fetchIngredients };
}

/* ─── Analyses for a feed ingredient ────────────────────────────────── */

interface UseAnalysesParams {
  feedId: string | null;
  page?: number;
  limit?: number;
}

interface UseAnalysesResult {
  analyses: AnalysisItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFeedAnalyses(params: UseAnalysesParams): UseAnalysesResult {
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { feedId, page, limit } = params;

  const fetchAnalyses = useCallback(async () => {
    if (!feedId) {
      setAnalyses([]);
      setMeta(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));

      const qs = query.toString();
      const path = `/org/feed-ingredients/${feedId}/analyses${qs ? `?${qs}` : ''}`;
      const result = await api.get<AnalysesResponse>(path);
      setAnalyses(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar análises';
      setError(message);
      setAnalyses([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [feedId, page, limit]);

  useEffect(() => {
    void fetchAnalyses();
  }, [fetchAnalyses]);

  return { analyses, meta, isLoading, error, refetch: fetchAnalyses };
}

/* ─── Comparison for a specific analysis ────────────────────────────── */

interface UseComparisonResult {
  comparison: ComparisonItem[];
  isLoading: boolean;
  error: string | null;
}

export function useAnalysisComparison(
  feedId: string | null,
  analysisId: string | null,
): UseComparisonResult {
  const [comparison, setComparison] = useState<ComparisonItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!feedId || !analysisId) {
      setComparison([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.get<{ data: ComparisonItem[] }>(
          `/org/feed-ingredients/${feedId}/analyses/${analysisId}/compare`,
        );
        if (!cancelled) setComparison(result.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar comparação');
          setComparison([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [feedId, analysisId]);

  return { comparison, isLoading, error };
}

/* ─── Quality trend ─────────────────────────────────────────────────── */

interface UseQualityTrendResult {
  trend: QualityTrendPoint[];
  isLoading: boolean;
  error: string | null;
}

export function useQualityTrend(feedId: string | null): UseQualityTrendResult {
  const [trend, setTrend] = useState<QualityTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!feedId) {
      setTrend([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.get<{ data: QualityTrendPoint[] }>(
          `/org/feed-ingredients/${feedId}/quality-trend`,
        );
        if (!cancelled) setTrend(result.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar tendência');
          setTrend([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [feedId]);

  return { trend, isLoading, error };
}
