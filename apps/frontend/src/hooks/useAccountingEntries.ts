import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  AccountingEntry,
  AccountingEntryListFilters,
  PaginatedAccountingEntriesOutput,
} from '@/types/accounting-entries';

export function useAccountingEntries(initialFilters?: AccountingEntryListFilters) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const orgId = user?.organizationId;

  const refetch = useCallback(
    async (filters?: AccountingEntryListFilters) => {
      if (!orgId) return;
      const f = filters ?? initialFilters ?? {};
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (f.referenceMonth) params.set('referenceMonth', f.referenceMonth);
        if (f.farmId) params.set('farmId', f.farmId);
        if (f.entryType) params.set('entryType', f.entryType);
        if (f.page != null) params.set('page', String(f.page));
        if (f.limit != null) params.set('limit', String(f.limit));
        const qs = params.toString();
        const path = `/org/${orgId}/accounting-entries${qs ? `?${qs}` : ''}`;
        const result = await api.get<PaginatedAccountingEntriesOutput | AccountingEntry[]>(path);
        if (Array.isArray(result)) {
          setEntries(result);
          setTotalCount(result.length);
        } else {
          setEntries(result.data);
          setTotalCount(result.total);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao carregar lançamentos contábeis';
        setError(message);
        setEntries([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const exportCsv = useCallback(
    async (filters?: AccountingEntryListFilters) => {
      if (!orgId) return;
      const f = filters ?? {};
      try {
        const params = new URLSearchParams();
        if (f.referenceMonth) params.set('referenceMonth', f.referenceMonth);
        if (f.farmId) params.set('farmId', f.farmId);
        if (f.entryType) params.set('entryType', f.entryType);
        const qs = params.toString();
        const path = `/org/${orgId}/accounting-entries/export/csv${qs ? `?${qs}` : ''}`;
        const blob = await api.getBlob(path);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lancamentos-contabeis${f.referenceMonth ? `-${f.referenceMonth}` : ''}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao exportar CSV';
        setError(message);
      }
    },
    [orgId],
  );

  return { entries, isLoading, error, totalCount, refetch, exportCsv };
}
