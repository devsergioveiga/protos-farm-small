import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';

export interface ApprovalRule {
  id: string;
  name: string;
  requestType: string | null;
  minValue: number;
  maxValue: number | null;
  approver1Id: string;
  approver2Id: string | null;
  priority: number;
  isActive: boolean;
  approver1: { id: string; name: string; email: string };
  approver2?: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApprovalRuleInput {
  name: string;
  requestType?: string | null;
  minValue: number;
  maxValue?: number | null;
  approver1Id: string;
  approver2Id?: string | null;
  priority: number;
  isActive?: boolean;
}

export interface Delegation {
  id: string;
  delegatorId: string;
  delegateId: string;
  startDate: string;
  endDate: string;
  notes?: string;
  isActive: boolean;
  delegate: { id: string; name: string; email: string };
  delegator: { id: string; name: string; email: string };
  createdAt: string;
}

export interface CreateDelegationInput {
  delegateId: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

interface UseApprovalRulesResult {
  rules: ApprovalRule[];
  delegations: Delegation[];
  isLoading: boolean;
  error: string | null;
  createRule: (input: CreateApprovalRuleInput) => Promise<void>;
  updateRule: (id: string, input: Partial<CreateApprovalRuleInput>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  reorderRules: (orderedIds: string[]) => Promise<void>;
  createDelegation: (input: CreateDelegationInput) => Promise<void>;
  deactivateDelegation: (id: string) => Promise<void>;
  refresh: () => void;
}

export function useApprovalRules(): UseApprovalRulesResult {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rulesResult, delegationsResult] = await Promise.all([
        api.get<ApprovalRule[]>('/org/approval-rules'),
        api.get<Delegation[]>('/org/approval-rules/delegations'),
      ]);
      setRules(rulesResult);
      setDelegations(delegationsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar regras de alcada');
    } finally {
      setIsLoading(false);
    }
  }, [refreshCounter]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  async function createRule(input: CreateApprovalRuleInput): Promise<void> {
    await api.post<ApprovalRule>('/org/approval-rules', input);
    refresh();
  }

  async function updateRule(id: string, input: Partial<CreateApprovalRuleInput>): Promise<void> {
    await api.put<ApprovalRule>(`/org/approval-rules/${id}`, input);
    refresh();
  }

  async function deleteRule(id: string): Promise<void> {
    await api.delete(`/org/approval-rules/${id}`);
    refresh();
  }

  async function reorderRules(orderedIds: string[]): Promise<void> {
    await api.post<unknown>('/org/approval-rules/reorder', { orderedIds });
    refresh();
  }

  async function createDelegation(input: CreateDelegationInput): Promise<void> {
    await api.post<Delegation>('/org/approval-rules/delegations', input);
    refresh();
  }

  async function deactivateDelegation(id: string): Promise<void> {
    await api.patch<Delegation>(`/org/approval-rules/delegations/${id}/deactivate`, {});
    refresh();
  }

  function refresh() {
    setRefreshCounter((c) => c + 1);
  }

  return {
    rules,
    delegations,
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    reorderRules,
    createDelegation,
    deactivateDelegation,
    refresh,
  };
}
