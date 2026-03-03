import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { Organization, OrganizationsResponse, PaginationMeta } from '@/types/admin';

interface UseAdminOrganizationsParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

interface UseAdminOrganizationsResult {
  organizations: Organization[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAdminOrganizations(
  params: UseAdminOrganizationsParams = {},
): UseAdminOrganizationsResult {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, status, search } = params;

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (status) query.set('status', status);
      if (search) query.set('search', search);

      const qs = query.toString();
      const path = `/admin/organizations${qs ? `?${qs}` : ''}`;
      const result = await api.get<OrganizationsResponse>(path);
      setOrganizations(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar organizações';
      setError(message);
      setOrganizations([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, status, search]);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  return { organizations, meta, isLoading, error, refetch: fetchOrganizations };
}
