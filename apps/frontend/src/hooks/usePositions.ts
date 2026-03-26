import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { Position, PositionsResponse, StaffingViewItem } from '@/types/position';

interface UsePositionsParams {
  search?: string;
  page?: number;
  limit?: number;
}

interface UsePositionsResult {
  positions: Position[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePositions(params: UsePositionsParams = {}): UsePositionsResult {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, page, limit } = params;

  const fetchPositions = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId) {
      setPositions([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));

      const qs = query.toString();
      const path = `/org/${orgId}/positions${qs ? `?${qs}` : ''}`;
      const result = await api.get<PositionsResponse>(path);
      setPositions(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar cargos';
      setError(message);
      setPositions([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, search, page, limit]);

  useEffect(() => {
    void fetchPositions();
  }, [fetchPositions]);

  return { positions, total, isLoading, error, refetch: fetchPositions };
}

interface UseStaffingViewResult {
  staffing: StaffingViewItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStaffingView(): UseStaffingViewResult {
  const { user } = useAuth();
  const [staffing, setStaffing] = useState<StaffingViewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaffing = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId) {
      setStaffing([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<StaffingViewItem[]>(`/org/${orgId}/positions/staffing-view`);
      setStaffing(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar quadro de lotação';
      setError(message);
      setStaffing([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId]);

  useEffect(() => {
    void fetchStaffing();
  }, [fetchStaffing]);

  return { staffing, isLoading, error, refetch: fetchStaffing };
}
