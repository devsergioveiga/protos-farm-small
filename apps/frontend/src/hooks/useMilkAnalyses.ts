import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  MilkAnalysisItem,
  MilkAnalysesResponse,
  HighSccItem,
  QualityTrendItem,
  MilkQualityConfig,
  BonusResult,
} from '@/types/milk-analysis';
import type { PaginationMeta } from '@/types/admin';

/* ─── List hook ────────────────────────────────────────────────── */

interface UseMilkAnalysesParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  analysisType?: string;
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseMilkAnalysesResult {
  analyses: MilkAnalysisItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMilkAnalyses(params: UseMilkAnalysesParams): UseMilkAnalysesResult {
  const [analyses, setAnalyses] = useState<MilkAnalysisItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, analysisType, animalId, dateFrom, dateTo } = params;

  const fetchAnalyses = useCallback(async () => {
    if (!farmId) {
      setAnalyses([]);
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
      if (analysisType) query.set('analysisType', analysisType);
      if (animalId) query.set('animalId', animalId);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/milk-analysis${qs ? `?${qs}` : ''}`;
      const result = await api.get<MilkAnalysesResponse>(path);
      setAnalyses(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar análises de leite';
      setError(message);
      setAnalyses([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, analysisType, animalId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchAnalyses();
  }, [fetchAnalyses]);

  return { analyses, meta, isLoading, error, refetch: fetchAnalyses };
}

/* ─── High SCC hook ────────────────────────────────────────────── */

interface UseHighSccResult {
  cows: HighSccItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useHighScc(farmId: string | null): UseHighSccResult {
  const [cows, setCows] = useState<HighSccItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHighScc = useCallback(async () => {
    if (!farmId) {
      setCows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<HighSccItem[]>(`/org/farms/${farmId}/milk-analysis/high-scc`);
      setCows(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vacas com CCS elevada');
      setCows([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchHighScc();
  }, [fetchHighScc]);

  return { cows, isLoading, error, refetch: fetchHighScc };
}

/* ─── Quality Trend hook ───────────────────────────────────────── */

interface UseQualityTrendResult {
  trend: QualityTrendItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useQualityTrend(farmId: string | null): UseQualityTrendResult {
  const [trend, setTrend] = useState<QualityTrendItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrend = useCallback(async () => {
    if (!farmId) {
      setTrend([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<QualityTrendItem[]>(
        `/org/farms/${farmId}/milk-analysis/quality-trend`,
      );
      setTrend(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tendência de qualidade');
      setTrend([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchTrend();
  }, [fetchTrend]);

  return { trend, isLoading, error, refetch: fetchTrend };
}

/* ─── Config hook ──────────────────────────────────────────────── */

interface UseQualityConfigResult {
  config: MilkQualityConfig | null;
  bonus: BonusResult | null;
  isLoading: boolean;
  error: string | null;
  saveConfig: (data: MilkQualityConfig) => Promise<void>;
  fetchBonus: (farmId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useQualityConfig(): UseQualityConfigResult {
  const [config, setConfig] = useState<MilkQualityConfig | null>(null);
  const [bonus, setBonus] = useState<BonusResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<MilkQualityConfig>('/org/milk-analysis/quality-config');
      setConfig(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configuração');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const saveConfig = useCallback(async (data: MilkQualityConfig) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.put<MilkQualityConfig>('/org/milk-analysis/quality-config', data);
      setConfig(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBonus = useCallback(async (farmId: string) => {
    try {
      const result = await api.get<BonusResult>(`/org/farms/${farmId}/milk-analysis/bonus`);
      setBonus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao calcular bonificação');
    }
  }, []);

  return { config, bonus, isLoading, error, saveConfig, fetchBonus, refetch: fetchConfig };
}
