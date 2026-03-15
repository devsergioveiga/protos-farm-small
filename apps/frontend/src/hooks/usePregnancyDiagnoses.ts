import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  DiagnosisItem,
  DiagnosesResponse,
  CalvingCalendarItem,
  EmptyFemaleItem,
  DgIndicators,
} from '@/types/pregnancy-diagnosis';
import type { PaginationMeta } from '@/types/admin';

/* ─── List hook ──────────────────────────────────────────── */

interface UsePregnancyDiagnosesParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  result?: string;
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UsePregnancyDiagnosesResult {
  diagnoses: DiagnosisItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePregnancyDiagnoses(
  params: UsePregnancyDiagnosesParams,
): UsePregnancyDiagnosesResult {
  const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, result, animalId, dateFrom, dateTo } = params;

  const fetchDiagnoses = useCallback(async () => {
    if (!farmId) {
      setDiagnoses([]);
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
      if (result) query.set('result', result);
      if (animalId) query.set('animalId', animalId);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/pregnancy-diagnoses${qs ? `?${qs}` : ''}`;
      const res = await api.get<DiagnosesResponse>(path);
      setDiagnoses(res.data);
      setMeta(res.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar diagnósticos';
      setError(message);
      setDiagnoses([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, result, animalId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchDiagnoses();
  }, [fetchDiagnoses]);

  return { diagnoses, meta, isLoading, error, refetch: fetchDiagnoses };
}

/* ─── Calving Calendar hook ──────────────────────────────── */

interface UseCalvingCalendarResult {
  calendar: CalvingCalendarItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCalvingCalendar(farmId: string | null): UseCalvingCalendarResult {
  const [calendar, setCalendar] = useState<CalvingCalendarItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    if (!farmId) {
      setCalendar([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<CalvingCalendarItem[]>(
        `/org/farms/${farmId}/pregnancy-diagnoses/calving-calendar`,
      );
      setCalendar(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar calendário de partos');
      setCalendar([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  return { calendar, isLoading, error, refetch: fetchCalendar };
}

/* ─── Empty Females hook ─────────────────────────────────── */

interface UseEmptyFemalesResult {
  females: EmptyFemaleItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmptyFemales(farmId: string | null): UseEmptyFemalesResult {
  const [females, setFemales] = useState<EmptyFemaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFemales = useCallback(async () => {
    if (!farmId) {
      setFemales([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<EmptyFemaleItem[]>(
        `/org/farms/${farmId}/pregnancy-diagnoses/empty-females`,
      );
      setFemales(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fêmeas vazias');
      setFemales([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchFemales();
  }, [fetchFemales]);

  return { females, isLoading, error, refetch: fetchFemales };
}

/* ─── Indicators hook ────────────────────────────────────── */

interface UseIndicatorsResult {
  indicators: DgIndicators | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDgIndicators(farmId: string | null): UseIndicatorsResult {
  const [indicators, setIndicators] = useState<DgIndicators | null>(null);
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
      const res = await api.get<DgIndicators>(
        `/org/farms/${farmId}/pregnancy-diagnoses/indicators`,
      );
      setIndicators(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar indicadores');
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
