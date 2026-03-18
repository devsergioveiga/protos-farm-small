import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { PurchaseRequest, PurchaseRequestListResponse } from '../types/purchase-request';

interface UsePurchaseRequestsResult {
  data: PurchaseRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setStatus: (status: string) => void;
  setSearch: (search: string) => void;
  refresh: () => void;
}

export function usePurchaseRequests(): UsePurchaseRequestsResult {
  const [data, setData] = useState<PurchaseRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const LIMIT = 20;

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchRequests() {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(page));
        queryParams.set('limit', String(LIMIT));
        if (status) queryParams.set('status', status);
        if (search.trim()) queryParams.set('search', search.trim());

        const result = await api.get<PurchaseRequestListResponse>(
          `/org/purchase-requests?${queryParams.toString()}`,
        );
        if (!signal.aborted) {
          setData(result.data);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar requisicoes');
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void fetchRequests();
    return () => controller.abort();
  }, [page, status, search, refreshCounter]);

  function handleSetStatus(newStatus: string) {
    setStatus(newStatus);
    setPage(1);
  }

  function handleSetSearch(newSearch: string) {
    setSearch(newSearch);
    setPage(1);
  }

  function refresh() {
    setRefreshCounter((c) => c + 1);
  }

  return {
    data,
    total,
    page,
    limit: LIMIT,
    totalPages,
    isLoading,
    error,
    setPage,
    setStatus: handleSetStatus,
    setSearch: handleSetSearch,
    refresh,
  };
}
