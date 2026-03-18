import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { RuralCreditContract, ScheduleRow } from '@/types/rural-credit';

// ─── Query types ──────────────────────────────────────────────────

interface UseRuralCreditQuery {
  farmId?: string;
  status?: string;
  creditLine?: string;
}

// ─── useRuralCredit ───────────────────────────────────────────────

export function useRuralCredit(query: UseRuralCreditQuery = {}) {
  const [contracts, setContracts] = useState<RuralCreditContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, status, creditLine } = query;

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (farmId) qs.set('farmId', farmId);
      if (status) qs.set('status', status);
      if (creditLine) qs.set('creditLine', creditLine);
      const qsStr = qs.toString();
      const result = await api.get<RuralCreditContract[]>(
        `/org/rural-credit${qsStr ? `?${qsStr}` : ''}`,
      );
      setContracts(result ?? []);
    } catch {
      setError('Nao foi possivel carregar os contratos de credito rural.');
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [farmId, status, creditLine]);

  useEffect(() => {
    void fetchContracts();
  }, [fetchContracts]);

  return { contracts, loading, error, refetch: fetchContracts };
}

// ─── useRuralCreditDetail ─────────────────────────────────────────

export function useRuralCreditDetail(id: string | undefined) {
  const [contract, setContract] = useState<RuralCreditContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContract = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<RuralCreditContract>(`/org/rural-credit/${id}`);
      setContract(result);
    } catch {
      setError('Nao foi possivel carregar os dados do contrato.');
      setContract(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchContract();
  }, [fetchContract]);

  return { contract, loading, error, refetch: fetchContract };
}

// ─── useRuralCreditAlertCount ─────────────────────────────────────

export function useRuralCreditAlertCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ count: number }>('/org/rural-credit/alert-count');
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

// ─── Mutation functions ───────────────────────────────────────────

export interface CreateContractData {
  farmId: string;
  bankAccountId: string;
  creditLine: string;
  contractNumber?: string;
  principalAmount: number;
  annualRate: number;
  amortizationSystem: string;
  termMonths: number;
  gracePeriodMonths: number;
  firstPaymentYear: number;
  firstPaymentMonth: number;
  paymentDayOfMonth: number;
  releasedAt: string;
  iofAmount?: number;
  tacAmount?: number;
  alertDaysBefore?: number;
  guaranteeDescription?: string;
  notes?: string;
}

export async function createContract(data: CreateContractData): Promise<RuralCreditContract> {
  return api.post<RuralCreditContract>('/org/rural-credit', data);
}

export async function updateContract(
  id: string,
  data: Partial<CreateContractData>,
): Promise<RuralCreditContract> {
  return api.put<RuralCreditContract>(`/org/rural-credit/${id}`, data);
}

export async function cancelContract(id: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/org/rural-credit/${id}/cancel`);
}

export interface SimulateData {
  principalAmount: number;
  annualRate: number;
  amortizationSystem: string;
  termMonths: number;
  gracePeriodMonths: number;
  firstPaymentYear: number;
  firstPaymentMonth: number;
  paymentDayOfMonth: number;
}

export async function simulateSchedule(data: SimulateData): Promise<{ schedule: ScheduleRow[] }> {
  return api.post<{ schedule: ScheduleRow[] }>('/org/rural-credit/simulate', data);
}

export interface SettleInstallmentData {
  paidAmount: number;
  paidAt: string;
  interestAmount?: number;
  fineAmount?: number;
  discountAmount?: number;
}

export async function settleInstallment(
  contractId: string,
  payableId: string,
  data: SettleInstallmentData,
): Promise<RuralCreditContract> {
  return api.post<RuralCreditContract>(
    `/org/rural-credit/${contractId}/settle-installment/${payableId}`,
    data,
  );
}

export interface ExtraordinaryAmortizationData {
  amount: number;
  recalculationMode: 'REDUCE_TERM' | 'REDUCE_INSTALLMENT';
  paidAt: string;
}

export async function applyExtraordinaryAmortization(
  contractId: string,
  data: ExtraordinaryAmortizationData,
): Promise<RuralCreditContract> {
  return api.post<RuralCreditContract>(
    `/org/rural-credit/${contractId}/extraordinary-amortization`,
    data,
  );
}
