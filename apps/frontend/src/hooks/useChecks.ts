import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export type CheckType = 'EMITIDO' | 'RECEBIDO';
export type CheckStatus = 'EMITIDO' | 'A_COMPENSAR' | 'COMPENSADO' | 'DEVOLVIDO' | 'CANCELADO';

export interface CheckOutput {
  id: string;
  type: CheckType;
  status: CheckStatus;
  checkNumber: string;
  amount: number;
  bankAccountId: string;
  bankAccountName: string;
  issueDate: string;
  deliveryDate: string | null;
  expectedCompensationDate: string | null;
  compensationDate: string | null;
  payeeName: string;
  description: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateCheckInput {
  type: CheckType;
  checkNumber: string;
  payeeName: string;
  bankAccountId: string;
  amount: number;
  issueDate: string;
  deliveryDate?: string;
  expectedCompensationDate?: string;
  notes?: string;
}

interface UseChecksQuery {
  status?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

// ─── useChecks ─────────────────────────────────────────────────────

export function useChecks() {
  const [checks, setChecks] = useState<CheckOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChecks = useCallback(async (query: UseChecksQuery = {}) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (query.status) qs.set('status', query.status);
      if (query.type) qs.set('type', query.type);
      if (query.startDate) qs.set('startDate', query.startDate);
      if (query.endDate) qs.set('endDate', query.endDate);
      const queryStr = qs.toString();
      const result = await api.get<CheckOutput[]>(`/org/checks${queryStr ? `?${queryStr}` : ''}`);
      setChecks(result ?? []);
    } catch {
      setError('Não foi possível carregar os cheques.');
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChecks();
  }, [fetchChecks]);

  const createCheck = useCallback(
    async (input: CreateCheckInput) => {
      await api.post('/org/checks', input);
      await fetchChecks();
    },
    [fetchChecks],
  );

  const markACompensar = useCallback(
    async (id: string) => {
      await api.post(`/org/checks/${id}/mark-a-compensar`);
      await fetchChecks();
    },
    [fetchChecks],
  );

  const compensateCheck = useCallback(
    async (id: string, compensationDate?: string) => {
      await api.post(`/org/checks/${id}/compensate`, compensationDate ? { compensationDate } : {});
      await fetchChecks();
    },
    [fetchChecks],
  );

  const returnCheck = useCallback(
    async (id: string) => {
      await api.post(`/org/checks/${id}/return`);
      await fetchChecks();
    },
    [fetchChecks],
  );

  const resubmitCheck = useCallback(
    async (id: string, expectedCompensationDate?: string) => {
      await api.post(
        `/org/checks/${id}/resubmit`,
        expectedCompensationDate ? { expectedCompensationDate } : {},
      );
      await fetchChecks();
    },
    [fetchChecks],
  );

  const cancelCheck = useCallback(
    async (id: string) => {
      await api.post(`/org/checks/${id}/cancel`);
      await fetchChecks();
    },
    [fetchChecks],
  );

  return {
    checks,
    loading,
    error,
    fetchChecks,
    createCheck,
    markACompensar,
    compensateCheck,
    returnCheck,
    resubmitCheck,
    cancelCheck,
  };
}
