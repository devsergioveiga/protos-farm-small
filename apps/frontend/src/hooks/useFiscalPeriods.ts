import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { FiscalYear, CreateFiscalYearInput, AccountingPeriod } from '@/types/accounting';

// ─── useFiscalYears ──────────────────────────────────────────────────────────

export function useFiscalYears() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [data, setData] = useState<FiscalYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchYears = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<FiscalYear[]>(`/org/${orgId}/fiscal-years`);
      setData(result);
    } catch {
      setError('Não foi possível carregar os exercícios fiscais.');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchYears();
  }, [fetchYears]);

  return { data, isLoading, error, refetch: fetchYears };
}

// ─── useCreateFiscalYear ─────────────────────────────────────────────────────

export function useCreateFiscalYear() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (input: CreateFiscalYearInput): Promise<FiscalYear> => {
      if (!orgId) throw new Error('Organização não encontrada');
      setIsLoading(true);
      try {
        return await api.post<FiscalYear>(`/org/${orgId}/fiscal-years`, input);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { mutate, isLoading };
}

// ─── useClosePeriod ──────────────────────────────────────────────────────────

export function useClosePeriod() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (periodId: string, closedBy: string): Promise<AccountingPeriod> => {
      if (!orgId) throw new Error('Organização não encontrada');
      setIsLoading(true);
      try {
        return await api.post<AccountingPeriod>(
          `/org/${orgId}/accounting-periods/${periodId}/close`,
          { closedBy },
        );
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { mutate, isLoading };
}

// ─── useReopenPeriod ─────────────────────────────────────────────────────────

export function useReopenPeriod() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (
      periodId: string,
      reopenedBy: string,
      reopenReason: string,
    ): Promise<AccountingPeriod> => {
      if (!orgId) throw new Error('Organização não encontrada');
      setIsLoading(true);
      try {
        return await api.post<AccountingPeriod>(
          `/org/${orgId}/accounting-periods/${periodId}/reopen`,
          { reopenedBy, reopenReason },
        );
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { mutate, isLoading };
}

// ─── useBlockPeriod ──────────────────────────────────────────────────────────

export function useBlockPeriod() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (periodId: string): Promise<AccountingPeriod> => {
      if (!orgId) throw new Error('Organização não encontrada');
      setIsLoading(true);
      try {
        return await api.post<AccountingPeriod>(
          `/org/${orgId}/accounting-periods/${periodId}/block`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { mutate, isLoading };
}
