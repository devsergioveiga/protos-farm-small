import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { AccountingRule, UpdateRuleInput, RulePreview } from '@/types/auto-posting';

// ─── useAccountingRules ───────────────────────────────────────────────────────

export function useAccountingRules() {
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const [rules, setRules] = useState<AccountingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<AccountingRule[]>(`/org/${orgId}/auto-posting/rules`);
      setRules(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar regras');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  return { rules, isLoading, error, refetch: fetchRules };
}

// ─── useAccountingRuleActions ─────────────────────────────────────────────────

export function useAccountingRuleActions() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const updateRule = useCallback(
    async (ruleId: string, input: UpdateRuleInput): Promise<AccountingRule> => {
      if (!orgId) throw new Error('Organização não encontrada');
      return api.patch<AccountingRule>(`/org/${orgId}/auto-posting/rules/${ruleId}`, input);
    },
    [orgId],
  );

  const getPreview = useCallback(
    async (ruleId: string): Promise<RulePreview> => {
      if (!orgId) throw new Error('Organização não encontrada');
      return api.get<RulePreview>(`/org/${orgId}/auto-posting/rules/${ruleId}/preview`);
    },
    [orgId],
  );

  return { updateRule, getPreview };
}
