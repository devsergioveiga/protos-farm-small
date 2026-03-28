import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { MonthlyClosingOutput, StepResult } from '@/types/monthly-closing';

// ─── useMonthlyClosing ────────────────────────────────────────────────────────

export function useMonthlyClosing(periodId: string | undefined) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [closing, setClosing] = useState<MonthlyClosingOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClosing = useCallback(async () => {
    if (!orgId || !periodId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<MonthlyClosingOutput | null>(
        `/org/${orgId}/monthly-closing?periodId=${periodId}`,
      );
      setClosing(result);
    } catch {
      setError('Não foi possível carregar o fechamento mensal. Tente novamente.');
      setClosing(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, periodId]);

  useEffect(() => {
    void fetchClosing();
  }, [fetchClosing]);

  return { closing, loading, error, refetch: fetchClosing };
}

// ─── useStartClosing ──────────────────────────────────────────────────────────

export function useStartClosing() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [loading, setLoading] = useState(false);

  const startClosing = useCallback(
    async (periodId: string): Promise<MonthlyClosingOutput> => {
      if (!orgId) throw new Error('Organização não identificada');
      setLoading(true);
      try {
        const result = await api.post<MonthlyClosingOutput>(
          `/org/${orgId}/monthly-closing/start`,
          { periodId },
        );
        return result;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  return { startClosing, loading };
}

// ─── useValidateStep ──────────────────────────────────────────────────────────

export function useValidateStep() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [loading, setLoading] = useState(false);

  const validateStep = useCallback(
    async (closingId: string, stepNumber: number): Promise<StepResult> => {
      if (!orgId) throw new Error('Organização não identificada');
      setLoading(true);
      try {
        const result = await api.post<StepResult>(
          `/org/${orgId}/monthly-closing/${closingId}/validate-step/${stepNumber}`,
        );
        return result;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  return { validateStep, loading };
}

// ─── useCompleteClosing ───────────────────────────────────────────────────────

export function useCompleteClosing() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [loading, setLoading] = useState(false);

  const completeClosing = useCallback(
    async (closingId: string): Promise<MonthlyClosingOutput> => {
      if (!orgId) throw new Error('Organização não identificada');
      setLoading(true);
      try {
        const result = await api.post<MonthlyClosingOutput>(
          `/org/${orgId}/monthly-closing/${closingId}/complete`,
        );
        return result;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  return { completeClosing, loading };
}

// ─── useReopenClosing ─────────────────────────────────────────────────────────

export function useReopenClosing() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [loading, setLoading] = useState(false);

  const reopenClosing = useCallback(
    async (closingId: string, reason: string): Promise<MonthlyClosingOutput> => {
      if (!orgId) throw new Error('Organização não identificada');
      setLoading(true);
      try {
        const result = await api.post<MonthlyClosingOutput>(
          `/org/${orgId}/monthly-closing/${closingId}/reopen`,
          { reason },
        );
        return result;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  return { reopenClosing, loading };
}
