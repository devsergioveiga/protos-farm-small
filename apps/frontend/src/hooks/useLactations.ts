import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  LactationItem,
  LactationsResponse,
  LactationCurvePoint,
  DryingAlertItem,
} from '@/types/lactation';

/* ── List (paginated, filterable) ────────────────────────────────── */

interface UseLactationsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  status?: string;
  animalId?: string;
}

interface UseLactationsResult {
  lactations: LactationItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLactations(params: UseLactationsParams): UseLactationsResult {
  const [lactations, setLactations] = useState<LactationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, status, animalId } = params;

  const fetch = useCallback(async () => {
    if (!farmId) {
      setLactations([]);
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

      const qs = query.toString();
      const path = `/org/farms/${farmId}/lactations${qs ? `?${qs}` : ''}`;
      const result = await api.get<LactationsResponse>(path);
      setLactations(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar lactações';
      setError(message);
      setLactations([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, status, animalId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { lactations, total, isLoading, error, refetch: fetch };
}

/* ── Active lactations ───────────────────────────────────────────── */

interface UseActiveLactationsResult {
  lactations: LactationItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useActiveLactations(farmId: string | null): UseActiveLactationsResult {
  const [lactations, setLactations] = useState<LactationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!farmId) {
      setLactations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<{ data: LactationItem[] }>(
        `/org/farms/${farmId}/lactations/active`,
      );
      setLactations(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lactações ativas');
      setLactations([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { lactations, isLoading, error, refetch: fetch };
}

/* ── Drying alerts ───────────────────────────────────────────────── */

interface UseDryingAlertsResult {
  alerts: DryingAlertItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDryingAlerts(farmId: string | null): UseDryingAlertsResult {
  const [alerts, setAlerts] = useState<DryingAlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!farmId) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<{ data: DryingAlertItem[] }>(
        `/org/farms/${farmId}/lactations/drying-alerts`,
      );
      setAlerts(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar alertas de secagem');
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { alerts, isLoading, error, refetch: fetch };
}

/* ── Lactation curve ─────────────────────────────────────────────── */

interface UseLactationCurveResult {
  points: LactationCurvePoint[];
  isLoading: boolean;
  error: string | null;
}

export function useLactationCurve(
  farmId: string | null,
  lactationId: string | null,
): UseLactationCurveResult {
  const [points, setPoints] = useState<LactationCurvePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId || !lactationId) {
      setPoints([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = await api.get<{ data: LactationCurvePoint[] }>(
          `/org/farms/${farmId}/lactations/${lactationId}/curve`,
        );
        setPoints(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar curva de lactação');
        setPoints([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [farmId, lactationId]);

  return { points, isLoading, error };
}

/* ── Animal history ──────────────────────────────────────────────── */

interface UseAnimalLactationHistoryResult {
  lactations: LactationItem[];
  isLoading: boolean;
  error: string | null;
}

export function useAnimalLactationHistory(
  farmId: string | null,
  animalId: string | null,
): UseAnimalLactationHistoryResult {
  const [lactations, setLactations] = useState<LactationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId || !animalId) {
      setLactations([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = await api.get<{ data: LactationItem[] }>(
          `/org/farms/${farmId}/lactations/history/${animalId}`,
        );
        setLactations(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar histórico de lactações');
        setLactations([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [farmId, animalId]);

  return { lactations, isLoading, error };
}
