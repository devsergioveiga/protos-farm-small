import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  ChartOfAccount,
  CreateAccountInput,
  UpdateAccountInput,
  SeedResult,
} from '@/types/accounting';

// ─── useChartOfAccounts ──────────────────────────────────────────────────────

export function useChartOfAccounts() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [data, setData] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<ChartOfAccount[]>(`/org/${orgId}/chart-of-accounts`);
      setData(result);
    } catch {
      setError('Não foi possível carregar o plano de contas.');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  return { data, isLoading, error, refetch: fetchAccounts };
}

// ─── useCreateAccount ────────────────────────────────────────────────────────

export function useCreateAccount() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (input: CreateAccountInput): Promise<ChartOfAccount> => {
      if (!orgId) throw new Error('Organização não encontrada');
      setIsLoading(true);
      try {
        return await api.post<ChartOfAccount>(`/org/${orgId}/chart-of-accounts`, input);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { mutate, isLoading };
}

// ─── useUpdateAccount ────────────────────────────────────────────────────────

export function useUpdateAccount() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (id: string, input: UpdateAccountInput): Promise<ChartOfAccount> => {
      if (!orgId) throw new Error('Organização não encontrada');
      setIsLoading(true);
      try {
        return await api.put<ChartOfAccount>(`/org/${orgId}/chart-of-accounts/${id}`, input);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { mutate, isLoading };
}

// ─── useDeactivateAccount ────────────────────────────────────────────────────

export function useDeactivateAccount() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (id: string): Promise<{ message: string }> => {
      if (!orgId) throw new Error('Organização não encontrada');
      setIsLoading(true);
      try {
        return await api.delete<{ message: string }>(`/org/${orgId}/chart-of-accounts/${id}`);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId],
  );

  return { mutate, isLoading };
}

// ─── useSeedTemplate ─────────────────────────────────────────────────────────

export function useSeedTemplate() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(async (): Promise<SeedResult> => {
    if (!orgId) throw new Error('Organização não encontrada');
    setIsLoading(true);
    try {
      return await api.post<SeedResult>(`/org/${orgId}/chart-of-accounts/seed`);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  return { mutate, isLoading };
}

// ─── useUnmappedSped ─────────────────────────────────────────────────────────

export function useUnmappedSped() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [data, setData] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnmapped = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<ChartOfAccount[]>(
        `/org/${orgId}/chart-of-accounts/unmapped-sped`,
      );
      setData(result);
    } catch {
      setError('Não foi possível verificar contas sem mapeamento SPED.');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchUnmapped();
  }, [fetchUnmapped]);

  return { data, isLoading, error, refetch: fetchUnmapped };
}
