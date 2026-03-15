import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  CalvingEventItem,
  CalvingEventsResponse,
  UpcomingBirthItem,
  CalvingIndicators,
} from '@/types/calving-event';

/* ── List hook ────────────────────────────────────────────────────── */

interface UseCalvingEventsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  eventType?: string;
  motherId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseCalvingEventsResult {
  events: CalvingEventItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCalvingEvents(params: UseCalvingEventsParams): UseCalvingEventsResult {
  const [events, setEvents] = useState<CalvingEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, eventType, motherId, dateFrom, dateTo } = params;

  const fetchEvents = useCallback(async () => {
    if (!farmId) {
      setEvents([]);
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
      if (eventType) query.set('eventType', eventType);
      if (motherId) query.set('motherId', motherId);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/calving-events${qs ? `?${qs}` : ''}`;
      const result = await api.get<CalvingEventsResponse>(path);
      setEvents(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar eventos de parto';
      setError(message);
      setEvents([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, eventType, motherId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  return { events, total, isLoading, error, refetch: fetchEvents };
}

/* ── Upcoming births hook ─────────────────────────────────────────── */

interface UseUpcomingBirthsResult {
  upcoming: UpcomingBirthItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUpcomingBirths(farmId: string | null): UseUpcomingBirthsResult {
  const [upcoming, setUpcoming] = useState<UpcomingBirthItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUpcoming = useCallback(async () => {
    if (!farmId) {
      setUpcoming([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<UpcomingBirthItem[]>(
        `/org/farms/${farmId}/calving-events/upcoming`,
      );
      setUpcoming(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar próximos partos';
      setError(message);
      setUpcoming([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchUpcoming();
  }, [fetchUpcoming]);

  return { upcoming, isLoading, error, refetch: fetchUpcoming };
}

/* ── Indicators hook ──────────────────────────────────────────────── */

interface UseCalvingIndicatorsResult {
  indicators: CalvingIndicators | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCalvingIndicators(farmId: string | null): UseCalvingIndicatorsResult {
  const [indicators, setIndicators] = useState<CalvingIndicators | null>(null);
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
      const result = await api.get<CalvingIndicators>(
        `/org/farms/${farmId}/calving-events/indicators`,
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
