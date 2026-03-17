import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export type ReceivableStatus = 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'RENEGOTIATED' | 'CANCELLED';

export type ReceivableCategory =
  | 'GRAIN_SALE'
  | 'CATTLE_SALE'
  | 'MILK_SALE'
  | 'LEASE'
  | 'SERVICES'
  | 'OTHER';

export interface ReceivableInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: ReceivableStatus;
  receivedAt?: string;
  receivedAmount?: number;
}

export interface ReceivableCostCenterItem {
  id: string;
  costCenter: string;
  percentage?: number;
  fixedAmount?: number;
}

export interface ReceivableFarm {
  id: string;
  name: string;
}

export interface ReceivableProducer {
  id: string;
  name: string;
}

export interface ReceivableBankAccount {
  id: string;
  name: string;
}

export interface Receivable {
  id: string;
  clientName: string;
  category: ReceivableCategory;
  description: string;
  totalAmount: number;
  funruralRate?: number;
  funruralAmount?: number;
  nfeKey?: string;
  dueDate: string;
  documentNumber?: string;
  status: ReceivableStatus;
  notes?: string;
  farm?: ReceivableFarm;
  producer?: ReceivableProducer;
  bankAccount?: ReceivableBankAccount;
  installments: ReceivableInstallment[];
  costCenterItems: ReceivableCostCenterItem[];
  installmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivablesListResponse {
  data: Receivable[];
  total: number;
  page: number;
  limit: number;
}

export type AgingBucket =
  | 'OVERDUE'
  | 'DUE_IN_7'
  | 'DUE_IN_15'
  | 'DUE_IN_30'
  | 'DUE_IN_60'
  | 'DUE_IN_90'
  | 'DUE_AFTER_90';

export interface AgingBucketResult {
  bucket: AgingBucket;
  count: number;
  totalAmount: number;
}

export interface AgingResponse {
  buckets: AgingBucketResult[];
  totalReceivable: number;
  overdueAmount: number;
  overdueCount: number;
}

// ─── useReceivables ──────────────────────────────────────────────────

export interface UseReceivablesQuery {
  farmId?: string;
  status?: ReceivableStatus | '';
  category?: ReceivableCategory | '';
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  agingBucket?: AgingBucket | '';
}

export function useReceivables(query: UseReceivablesQuery = {}) {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, status, category, startDate, endDate, search, page, limit, agingBucket } = query;

  const fetchReceivables = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (farmId) qs.set('farmId', farmId);
      if (status) qs.set('status', status);
      if (category) qs.set('category', category);
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);
      if (search) qs.set('search', search);
      if (page) qs.set('page', String(page));
      if (limit) qs.set('limit', String(limit));
      if (agingBucket) qs.set('agingBucket', agingBucket);
      const queryStr = qs.toString();
      const result = await api.get<ReceivablesListResponse>(
        `/org/receivables${queryStr ? `?${queryStr}` : ''}`,
      );
      setReceivables(result?.data ?? []);
      setTotal(result?.total ?? 0);
    } catch {
      setError('Não foi possível carregar as contas a receber.');
      setReceivables([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, status, category, startDate, endDate, search, page, limit, agingBucket]);

  useEffect(() => {
    void fetchReceivables();
  }, [fetchReceivables]);

  return { receivables, total, isLoading, error, refetch: fetchReceivables };
}

// ─── useReceivablesAging ─────────────────────────────────────────────

export function useReceivablesAging(farmId?: string) {
  const [aging, setAging] = useState<AgingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAging = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (farmId) qs.set('farmId', farmId);
      const queryStr = qs.toString();
      const result = await api.get<AgingResponse>(
        `/org/receivables/aging${queryStr ? `?${queryStr}` : ''}`,
      );
      setAging(result);
    } catch {
      setError('Não foi possível carregar o aging de recebíveis.');
      setAging(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchAging();
  }, [fetchAging]);

  return { aging, isLoading, error, refetch: fetchAging };
}
