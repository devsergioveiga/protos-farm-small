import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────

export const GR_RETURN_STATUSES = [
  'PENDENTE',
  'EM_ANALISE',
  'APROVADA',
  'CONCLUIDA',
  'CANCELADA',
] as const;

export type GoodsReturnStatus = (typeof GR_RETURN_STATUSES)[number];

export const GR_RETURN_STATUS_LABELS: Record<GoodsReturnStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ANALISE: 'Em Analise',
  APROVADA: 'Aprovada',
  CONCLUIDA: 'Concluida',
  CANCELADA: 'Cancelada',
};

export const GR_RETURN_STATUS_COLORS: Record<GoodsReturnStatus, string> = {
  PENDENTE: 'badge--neutral',
  EM_ANALISE: 'badge--info',
  APROVADA: 'badge--success',
  CONCLUIDA: 'badge--primary',
  CANCELADA: 'badge--error',
};

export const GR_RETURN_REASON_LABELS: Record<string, string> = {
  DEFEITO: 'Defeito',
  VALIDADE: 'Validade vencida',
  PRODUTO_ERRADO: 'Produto errado',
  EXCEDENTE: 'Excedente',
  ESPECIFICACAO_DIVERGENTE: 'Especificacao divergente',
};

export const GR_RETURN_ACTION_LABELS: Record<string, string> = {
  TROCA: 'Troca',
  CREDITO: 'Credito',
  ESTORNO: 'Estorno',
};

export interface GoodsReturnListItem {
  id: string;
  sequentialNumber: string;
  supplierName: string;
  status: GoodsReturnStatus;
  statusLabel: string;
  reason: string;
  reasonLabel: string;
  expectedAction: string;
  actionLabel: string;
  totalValue: number | null;
  itemCount: number;
  createdAt: string;
}

export interface GoodsReturnItemOutput {
  id: string;
  productName: string;
  unitName: string;
  returnQty: number;
  unitPrice: number;
  totalPrice: number;
  photoUrl: string | null;
  batchNumber: string | null;
  notes: string | null;
}

export interface GoodsReturnOutput {
  id: string;
  sequentialNumber: string;
  goodsReceiptId: string;
  supplierId: string;
  supplierName: string;
  status: GoodsReturnStatus;
  statusLabel: string;
  reason: string;
  reasonLabel: string;
  expectedAction: string;
  actionLabel: string;
  resolutionStatus: string | null;
  resolutionDeadline: string | null;
  returnInvoiceNumber: string | null;
  returnInvoiceDate: string | null;
  notes: string | null;
  totalValue: number | null;
  items: GoodsReturnItemOutput[];
  goodsReceipt: {
    sequentialNumber: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReturnItemInput {
  goodsReceiptItemId: string;
  returnQty: number;
  notes?: string;
}

export interface CreateGoodsReturnInput {
  goodsReceiptId: string;
  reason: string;
  expectedAction: string;
  resolutionDeadline?: string;
  returnInvoiceNumber?: string;
  returnInvoiceDate?: string;
  notes?: string;
  items: GoodsReturnItemInput[];
}

export interface TransitionGoodsReturnInput {
  status: string;
  notes?: string;
}

// ─── useGoodsReturns ─────────────────────────────────────────────

interface GoodsReturnsFilters {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

interface GoodsReturnsResponse {
  data: GoodsReturnListItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface UseGoodsReturnsResult {
  goodsReturns: GoodsReturnListItem[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGoodsReturns(filters: GoodsReturnsFilters = {}): UseGoodsReturnsResult {
  const [goodsReturns, setGoodsReturns] = useState<GoodsReturnListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { page = 1, limit = 20, status, supplierId, startDate, endDate, search } = filters;

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
        if (supplierId) params.set('supplierId', supplierId);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (search) params.set('search', search);

        const data = await api.get<GoodsReturnsResponse>(`/org/goods-returns?${params.toString()}`);
        if (!cancelled) {
          setGoodsReturns(data.data);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar devoluções');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [page, limit, status, supplierId, startDate, endDate, search, refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { goodsReturns, total, totalPages, isLoading, error, refetch };
}

// ─── useGoodsReturn (single) ─────────────────────────────────────

interface UseGoodsReturnResult {
  goodsReturn: GoodsReturnOutput | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGoodsReturn(id: string | null): UseGoodsReturnResult {
  const [goodsReturn, setGoodsReturn] = useState<GoodsReturnOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.get<GoodsReturnOutput>(`/org/goods-returns/${id}`);
        if (!cancelled) setGoodsReturn(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar devolução');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { goodsReturn, isLoading, error, refetch };
}

// ─── API functions ────────────────────────────────────────────────

export async function createGoodsReturn(input: CreateGoodsReturnInput): Promise<GoodsReturnOutput> {
  return api.post<GoodsReturnOutput>('/org/goods-returns', input);
}

export async function transitionGoodsReturn(
  id: string,
  input: TransitionGoodsReturnInput,
): Promise<GoodsReturnOutput> {
  return api.patch<GoodsReturnOutput>(`/org/goods-returns/${id}/transition`, input);
}

export async function uploadReturnPhoto(
  returnId: string,
  itemId: string,
  file: File,
): Promise<{ photoUrl: string }> {
  const formData = new FormData();
  formData.append('photo', file);
  return api.postFormData<{ photoUrl: string }>(
    `/org/goods-returns/${returnId}/items/${itemId}/photo`,
    formData,
  );
}

export async function deleteGoodsReturn(id: string): Promise<void> {
  return api.delete<void>(`/org/goods-returns/${id}`);
}
