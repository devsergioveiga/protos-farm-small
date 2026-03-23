import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export type PayableStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'PARTIAL';
export type PayableCategory =
  | 'SUPPLIER'
  | 'EMPLOYEE'
  | 'TAXES'
  | 'UTILITIES'
  | 'MAINTENANCE'
  | 'FUEL'
  | 'FEED'
  | 'VETERINARY'
  | 'AGROCHEMICAL'
  | 'FERTILIZER'
  | 'SEED'
  | 'EQUIPMENT'
  | 'FINANCE'
  | 'ASSET_ACQUISITION'
  | 'OTHER';

export interface CostCenterItem {
  id: string;
  costCenter: string;
  farmId?: string;
  farmName?: string;
  percentage?: number;
  amount?: number;
}

export interface PayableInstallment {
  id: string;
  number: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
  status: PayableStatus;
  paidAt?: string;
  paidAmount?: number;
  bankAccountId?: string;
}

export interface Payable {
  id: string;
  supplierName: string;
  category: PayableCategory;
  description?: string;
  totalAmount: number;
  dueDate: string;
  status: PayableStatus;
  installmentCount: number;
  installmentNumber: number;
  farmId?: string;
  farmName?: string;
  producerId?: string;
  producerName?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  documentNumber?: string;
  notes?: string;
  paidAt?: string;
  paidAmount?: number;
  interestAmount?: number;
  fineAmount?: number;
  discountAmount?: number;
  costCenterItems: CostCenterItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PayablesListResponse {
  data: Payable[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AgingBucket {
  bucket: string;
  label: string;
  count: number;
  total: number;
}

export interface AgingResponse {
  buckets: AgingBucket[];
  grandTotal: number;
  grandCount: number;
  overdueTotal: number;
  overdueCount: number;
}

export interface CalendarDay {
  day: number;
  count: number;
  total: number;
  payables: Array<{
    id: string;
    supplierName: string;
    amount: number;
    status: PayableStatus;
  }>;
}

// ─── usePayables ──────────────────────────────────────────────────

interface UsePayablesQuery {
  farmId?: string;
  status?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function usePayables(query: UsePayablesQuery = {}) {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [meta, setMeta] = useState<PayablesListResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, status, category, startDate, endDate, search, page = 1, limit = 20 } = query;

  const fetchPayables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (farmId) qs.set('farmId', farmId);
      if (status) qs.set('status', status);
      if (category) qs.set('category', category);
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);
      if (search) qs.set('search', search);
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      const result = await api.get<PayablesListResponse>(`/org/payables?${qs.toString()}`);
      setPayables(result?.data ?? []);
      setMeta(result?.meta ?? null);
    } catch {
      setError('Não foi possível carregar as contas a pagar.');
      setPayables([]);
    } finally {
      setLoading(false);
    }
  }, [farmId, status, category, startDate, endDate, search, page, limit]);

  useEffect(() => {
    void fetchPayables();
  }, [fetchPayables]);

  return { payables, meta, loading, error, refetch: fetchPayables };
}

// ─── usePayablesAging ─────────────────────────────────────────────

export function usePayablesAging(farmId?: string) {
  const [aging, setAging] = useState<AgingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAging = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (farmId) qs.set('farmId', farmId);
      const result = await api.get<AgingResponse>(
        `/org/payables-aging${farmId ? `?${qs.toString()}` : ''}`,
      );
      setAging(result);
    } catch {
      setError('Não foi possível carregar o aging.');
      setAging(null);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchAging();
  }, [fetchAging]);

  return { aging, loading, error, refetch: fetchAging };
}

// ─── usePayableCalendar ──────────────────────────────────────────

export function usePayableCalendar(year: number, month: number, farmId?: string) {
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('year', String(year));
      qs.set('month', String(month));
      if (farmId) qs.set('farmId', farmId);
      const result = await api.get<{ days: CalendarDay[] }>(
        `/org/payables-aging/calendar?${qs.toString()}`,
      );
      setDays(result?.days ?? []);
    } catch {
      setError('Não foi possível carregar o calendário.');
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, farmId]);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  return { days, loading, error, refetch: fetchCalendar };
}

// ─── useOverdueCount ─────────────────────────────────────────────

export function useOverdueCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ count: number }>('/org/payables-aging/overdue-count');
      setCount(result?.count ?? 0);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  return { count, loading, refetch: fetchCount };
}
