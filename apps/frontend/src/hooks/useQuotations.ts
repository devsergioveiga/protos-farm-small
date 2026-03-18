import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type {
  Quotation,
  QuotationListResponse,
  ComparativeMapData,
  CreateQuotationInput,
  RegisterProposalInput,
  ApproveQuotationInput,
} from '../types/quotation';

// ─── useQuotations (list) ─────────────────────────────────────────────────

interface UseQuotationsFilters {
  status?: string;
  search?: string;
}

interface UseQuotationsResult {
  quotations: Quotation[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setStatus: (status: string) => void;
  setSearch: (search: string) => void;
  refresh: () => void;
}

export function useQuotations(filters?: UseQuotationsFilters): UseQuotationsResult {
  void filters; // filters applied via setStatus/setSearch; kept for API symmetry
  const [quotations, setQuotations] = useState<Quotation[]>([]);
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

    async function fetchQuotations() {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(page));
        queryParams.set('limit', String(LIMIT));
        if (status) queryParams.set('status', status);
        if (search.trim()) queryParams.set('search', search.trim());

        const result = await api.get<QuotationListResponse>(
          `/org/quotations?${queryParams.toString()}`,
        );
        if (!signal.aborted) {
          setQuotations(result.data);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar cotacoes');
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void fetchQuotations();
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
    quotations,
    total,
    page,
    totalPages,
    isLoading,
    error,
    setPage,
    setStatus: handleSetStatus,
    setSearch: handleSetSearch,
    refresh,
  };
}

// ─── useQuotation (single) ────────────────────────────────────────────────

interface UseQuotationResult {
  quotation: Quotation | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useQuotation(id: string | null): UseQuotationResult {
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!id) {
      setQuotation(null);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchQuotation() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.get<Quotation>(`/org/quotations/${id}`);
        if (!signal.aborted) {
          setQuotation(result);
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar cotacao');
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void fetchQuotation();
    return () => controller.abort();
  }, [id, refreshCounter]);

  function refetch() {
    setRefreshCounter((c) => c + 1);
  }

  return { quotation, isLoading, error, refetch };
}

// ─── useComparativeMap ────────────────────────────────────────────────────

interface UseComparativeMapResult {
  data: ComparativeMapData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useComparativeMap(quotationId: string | null): UseComparativeMapResult {
  const [data, setData] = useState<ComparativeMapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!quotationId) {
      setData(null);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchComparativeMap() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.get<ComparativeMapData>(
          `/org/quotations/${quotationId}/comparative`,
        );
        if (!signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar mapa comparativo');
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void fetchComparativeMap();
    return () => controller.abort();
  }, [quotationId, refreshCounter]);

  function refetch() {
    setRefreshCounter((c) => c + 1);
  }

  return { data, isLoading, error, refetch };
}

// ─── Mutation helpers ─────────────────────────────────────────────────────

export async function createQuotation(input: CreateQuotationInput): Promise<Quotation> {
  return api.post<Quotation>('/org/quotations', input);
}

export async function registerProposal(
  quotationId: string,
  qsId: string,
  data: RegisterProposalInput,
  file?: File,
): Promise<unknown> {
  const formData = new FormData();
  formData.append('data', JSON.stringify(data));
  if (file) {
    formData.append('file', file);
  }
  return api.postFormData<unknown>(
    `/org/quotations/${quotationId}/suppliers/${qsId}/proposal`,
    formData,
  );
}

export async function approveQuotation(
  quotationId: string,
  input: ApproveQuotationInput,
): Promise<unknown> {
  return api.patch<unknown>(`/org/quotations/${quotationId}/approve`, input);
}

export async function transitionQuotation(quotationId: string, status: string): Promise<unknown> {
  return api.patch<unknown>(`/org/quotations/${quotationId}/transition`, { status });
}

export async function deleteQuotation(quotationId: string): Promise<unknown> {
  return api.delete<unknown>(`/org/quotations/${quotationId}`);
}
