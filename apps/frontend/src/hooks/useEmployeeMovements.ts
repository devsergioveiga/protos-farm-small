import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

export interface EmployeeMovement {
  id: string;
  employeeId: string;
  movementType: string;
  effectiveAt: string;
  reason?: string;
  fromValue?: unknown;
  toValue?: unknown;
  createdBy: string;
  createdAt: string;
}

export interface TimelineEntry {
  date: string;
  type: string;
  description: string;
  details?: Record<string, unknown>;
}

interface UseEmployeeMovementsParams {
  employeeId?: string;
  page?: number;
  limit?: number;
}

interface UseEmployeeMovementsResult {
  movements: EmployeeMovement[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmployeeMovements(
  params: UseEmployeeMovementsParams = {},
): UseEmployeeMovementsResult {
  const { user } = useAuth();
  const [movements, setMovements] = useState<EmployeeMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { employeeId, page, limit } = params;

  const fetchMovements = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId) {
      setMovements([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (employeeId) query.set('employeeId', employeeId);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));

      const qs = query.toString();
      const path = `/org/${orgId}/employee-movements${qs ? `?${qs}` : ''}`;
      const result = await api.get<{ data: EmployeeMovement[]; total: number }>(path);
      setMovements(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar movimentações';
      setError(message);
      setMovements([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, employeeId, page, limit]);

  useEffect(() => {
    void fetchMovements();
  }, [fetchMovements]);

  return { movements, total, isLoading, error, refetch: fetchMovements };
}

interface UseEmployeeTimelineResult {
  timeline: TimelineEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmployeeTimeline(employeeId: string | null): UseEmployeeTimelineResult {
  const { user } = useAuth();
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId || !employeeId) {
      setTimeline([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<TimelineEntry[]>(
        `/org/${orgId}/employee-movements/timeline/${employeeId}`,
      );
      setTimeline(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar timeline';
      setError(message);
      setTimeline([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, employeeId]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  return { timeline, isLoading, error, refetch: fetchTimeline };
}
