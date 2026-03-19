import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  GoodsReceipt,
  GoodsReceiptListItem,
  PendingDelivery,
  CreateGoodsReceiptInput,
} from '@/types/goods-receipt';

// ─── useGoodsReceipts ─────────────────────────────────────────────

interface GoodsReceiptsFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  receivingType?: string;
}

interface GoodsReceiptsResponse {
  data: GoodsReceiptListItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface UseGoodsReceiptsResult {
  goodsReceipts: GoodsReceiptListItem[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGoodsReceipts(filters: GoodsReceiptsFilters = {}): UseGoodsReceiptsResult {
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceiptListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { page = 1, limit = 20, status, search, receivingType } = filters;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(limit));
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        if (receivingType) params.set('receivingType', receivingType);

        const data = await api.get<GoodsReceiptsResponse>(
          `/org/goods-receipts?${params.toString()}`,
        );
        if (!cancelled) {
          setGoodsReceipts(data.data);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar recebimentos');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [page, limit, status, search, receivingType, refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { goodsReceipts, total, totalPages, isLoading, error, refetch };
}

// ─── usePendingDeliveries ─────────────────────────────────────────

interface UsePendingDeliveriesResult {
  deliveries: PendingDelivery[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePendingDeliveries(): UsePendingDeliveriesResult {
  const [deliveries, setDeliveries] = useState<PendingDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.get<PendingDelivery[]>('/org/goods-receipts/pending');
        if (!cancelled) {
          setDeliveries(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar entregas pendentes');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { deliveries, isLoading, error, refetch };
}

// ─── API functions (for modal use in Plan 05) ─────────────────────

export async function createGoodsReceiptApi(input: CreateGoodsReceiptInput): Promise<GoodsReceipt> {
  return api.post<GoodsReceipt>('/org/goods-receipts', input);
}

export async function getGoodsReceiptApi(id: string): Promise<GoodsReceipt> {
  return api.get<GoodsReceipt>(`/org/goods-receipts/${id}`);
}

export async function transitionGoodsReceiptApi(
  id: string,
  status: string,
  rejectionReason?: string,
): Promise<GoodsReceipt> {
  return api.put<GoodsReceipt>(`/org/goods-receipts/${id}/transition`, { status, rejectionReason });
}

export async function confirmGoodsReceiptApi(id: string): Promise<GoodsReceipt> {
  return api.put<GoodsReceipt>(`/org/goods-receipts/${id}/confirm`);
}

export async function uploadDivergencePhotoApi(
  goodsReceiptId: string,
  divergenceId: string,
  file: File,
): Promise<{ photoUrl: string; photoFileName: string }> {
  const formData = new FormData();
  formData.append('photo', file);
  return api.postFormData<{ photoUrl: string; photoFileName: string }>(
    `/org/goods-receipts/${goodsReceiptId}/divergences/${divergenceId}/photo`,
    formData,
  );
}
