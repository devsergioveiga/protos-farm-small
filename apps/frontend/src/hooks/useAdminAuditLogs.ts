import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AuditLog, AuditLogsResponse, PaginationMeta } from '@/types/admin';

interface UseAdminAuditLogsParams {
  page?: number;
  limit?: number;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  organizationId?: string;
}

interface UseAdminAuditLogsResult {
  logs: AuditLog[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAdminAuditLogs(params: UseAdminAuditLogsParams = {}): UseAdminAuditLogsResult {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, action, dateFrom, dateTo, organizationId } = params;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (action) query.set('action', action);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      if (organizationId) query.set('organizationId', organizationId);

      const qs = query.toString();
      const path = `/admin/audit-logs${qs ? `?${qs}` : ''}`;
      const result = await api.get<AuditLogsResponse>(path);
      setLogs(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar logs de auditoria';
      setError(message);
      setLogs([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, action, dateFrom, dateTo, organizationId]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return { logs, meta, isLoading, error, refetch: fetchLogs };
}
