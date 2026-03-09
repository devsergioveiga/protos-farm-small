import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FieldTeamItem, FieldTeamsResponse } from '@/types/field-team';
import type { PaginationMeta } from '@/types/admin';

interface UseFieldTeamsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  teamType?: string;
  search?: string;
}

interface UseFieldTeamsResult {
  teams: FieldTeamItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFieldTeams(params: UseFieldTeamsParams): UseFieldTeamsResult {
  const [teams, setTeams] = useState<FieldTeamItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, teamType, search } = params;

  const fetchTeams = useCallback(async () => {
    if (!farmId) {
      setTeams([]);
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
      if (teamType) query.set('teamType', teamType);
      if (search) query.set('search', search);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/field-teams${qs ? `?${qs}` : ''}`;
      const result = await api.get<FieldTeamsResponse>(path);
      setTeams(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar equipes';
      setError(message);
      setTeams([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, teamType, search]);

  useEffect(() => {
    void fetchTeams();
  }, [fetchTeams]);

  return { teams, meta, isLoading, error, refetch: fetchTeams };
}
