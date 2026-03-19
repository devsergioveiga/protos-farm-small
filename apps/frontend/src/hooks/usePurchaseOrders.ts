import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  PurchaseOrder,
  PurchaseOrderListItem,
  CreateEmergencyPOInput,
  DuplicatePOInput,
  UpdatePOInput,
  TransitionPOInput,
} from '@/types/purchase-order';

interface PurchaseOrdersFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  overdue?: boolean;
}

interface PurchaseOrdersResponse {
  purchaseOrders: PurchaseOrderListItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface UsePurchaseOrdersResult {
  purchaseOrders: PurchaseOrderListItem[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePurchaseOrders(filters: PurchaseOrdersFilters = {}): UsePurchaseOrdersResult {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { page = 1, limit = 20, status, search, overdue } = filters;

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
        if (overdue) params.set('overdue', 'true');

        const data = await api.get<PurchaseOrdersResponse>(
          `/org/purchase-orders?${params.toString()}`,
        );
        if (!cancelled) {
          setPurchaseOrders(data.purchaseOrders);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos de compra');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [page, limit, status, search, overdue, refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { purchaseOrders, total, totalPages, isLoading, error, refetch };
}

interface UsePurchaseOrderResult {
  purchaseOrder: PurchaseOrder | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePurchaseOrder(id: string | null): UsePurchaseOrderResult {
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  useEffect(() => {
    if (!id) {
      setPurchaseOrder(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.get<PurchaseOrder>(`/org/purchase-orders/${id}`);
        if (!cancelled) setPurchaseOrder(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar pedido de compra');
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

  return { purchaseOrder, isLoading, error, refetch };
}

export async function createEmergencyPO(input: CreateEmergencyPOInput): Promise<PurchaseOrder> {
  return api.post<PurchaseOrder>('/org/purchase-orders', input);
}

export async function duplicatePO(input: DuplicatePOInput): Promise<PurchaseOrder> {
  return api.post<PurchaseOrder>('/org/purchase-orders/duplicate', input);
}

export async function updatePO(id: string, input: UpdatePOInput): Promise<PurchaseOrder> {
  return api.patch<PurchaseOrder>(`/org/purchase-orders/${id}`, input);
}

export async function transitionPO(id: string, input: TransitionPOInput): Promise<PurchaseOrder> {
  return api.patch<PurchaseOrder>(`/org/purchase-orders/${id}/transition`, input);
}

export async function deletePO(id: string): Promise<void> {
  return api.delete<void>(`/org/purchase-orders/${id}`);
}

export async function sendPOEmail(
  id: string,
  input: { to: string; subject: string; body: string },
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `/org/purchase-orders/${id}/send-email`,
    input,
  );
}

export async function downloadPOPdf(id: string, sequentialNumber: string): Promise<void> {
  const blob = await api.getBlob(`/org/purchase-orders/${id}/pdf`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OC-${sequentialNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
