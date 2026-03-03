import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { OrgUserListItem, OrgUsersResponse } from '@/types/org-user';
import type { PaginationMeta } from '@/types/admin';

interface UseOrgUsersParams {
  search?: string;
  page?: number;
  limit?: number;
  role?: string;
  farmId?: string;
  status?: string;
}

interface UseOrgUsersResult {
  users: OrgUserListItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrgUsers(params: UseOrgUsersParams = {}): UseOrgUsersResult {
  const [users, setUsers] = useState<OrgUserListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, page, limit, role, farmId, status } = params;

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (role) query.set('role', role);
      if (farmId) query.set('farmId', farmId);
      if (status) query.set('status', status);

      const qs = query.toString();
      const path = `/org/users${qs ? `?${qs}` : ''}`;
      const result = await api.get<OrgUsersResponse>(path);
      setUsers(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar usuários';
      setError(message);
      setUsers([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [search, page, limit, role, farmId, status]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  return { users, meta, isLoading, error, refetch: fetchUsers };
}
