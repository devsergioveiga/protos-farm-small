import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { TeamOperationItem, TeamOperationsResponse } from '@/types/team-operation';
import type { PaginationMeta } from '@/types/admin';

interface UseTeamOperationsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  teamId?: string;
  fieldPlotId?: string;
  operationType?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseTeamOperationsResult {
  operations: TeamOperationItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTeamOperations(params: UseTeamOperationsParams): UseTeamOperationsResult {
  const [operations, setOperations] = useState<TeamOperationItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, teamId, fieldPlotId, operationType, dateFrom, dateTo } = params;

  const fetchOperations = useCallback(async () => {
    if (!farmId) {
      setOperations([]);
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
      if (teamId) query.set('teamId', teamId);
      if (fieldPlotId) query.set('fieldPlotId', fieldPlotId);
      if (operationType) query.set('operationType', operationType);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/team-operations${qs ? `?${qs}` : ''}`;
      const result = await api.get<TeamOperationsResponse>(path);
      setOperations(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar operações';
      setError(message);
      setOperations([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, teamId, fieldPlotId, operationType, dateFrom, dateTo]);

  useEffect(() => {
    void fetchOperations();
  }, [fetchOperations]);

  return { operations, meta, isLoading, error, refetch: fetchOperations };
}
