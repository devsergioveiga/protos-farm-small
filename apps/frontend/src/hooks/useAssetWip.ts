import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WipStage {
  id: string;
  name: string;
  targetDate: string | null;
  completedAt: string | null;
  sortOrder: number;
}

export interface WipContribution {
  id: string;
  contributionDate: string;
  amount: number;
  description: string;
  supplierId: string | null;
  invoiceRef: string | null;
}

export interface WipSummary {
  assetId: string;
  assetName: string;
  assetTag: string;
  status: string;
  budget: number | null;
  budgetAlertPct: number;
  totalContributed: number;
  contributionCount: number;
  budgetAlert: boolean;
  budgetExceeded: boolean;
  stages: WipStage[];
  contributions: WipContribution[];
}

export interface AddContributionInput {
  contributionDate: string;
  amount: number;
  description: string;
  stageId?: string;
  supplierId?: string;
  invoiceRef?: string;
  notes?: string;
}

export interface AddContributionResult {
  contribution: WipContribution;
  totalContributed: number;
  budgetAlert: boolean;
  budgetExceeded: boolean;
}

export interface ActivateResult {
  assetId: string;
  finalValue: number;
  depreciationConfigMissing: boolean;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAssetWip(assetId: string) {
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const [summary, setSummary] = useState<WipSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await api.get<WipSummary>(`/org/${orgId}/asset-wip/${assetId}/summary`);
      setSummary(res);
    } catch {
      setError('Nao foi possivel carregar os dados do andamento.');
    } finally {
      setLoading(false);
    }
  }, [orgId, assetId]);

  const addContribution = useCallback(
    async (input: AddContributionInput): Promise<AddContributionResult> => {
      if (!orgId) throw new Error('Missing org');
      const res = await api.post<AddContributionResult>(
        `/org/${orgId}/asset-wip/${assetId}/contributions`,
        input,
      );
      return res;
    },
    [orgId, assetId],
  );

  const activate = useCallback(
    async (activationDate?: string): Promise<ActivateResult> => {
      if (!orgId) throw new Error('Missing org');
      const res = await api.post<ActivateResult>(`/org/${orgId}/asset-wip/${assetId}/activate`, {
        activationDate,
      });
      return res;
    },
    [orgId, assetId],
  );

  return { summary, loading, error, fetchSummary, addContribution, activate };
}
