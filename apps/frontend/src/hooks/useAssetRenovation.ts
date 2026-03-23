import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CreateRenovationInput {
  description: string;
  renovationDate: string;
  totalCost: number;
  accountingDecision: 'CAPITALIZAR' | 'DESPESA';
  newUsefulLifeMonths?: number;
  notes?: string;
}

export interface Renovation {
  id: string;
  description: string;
  renovationDate: string;
  totalCost: number;
  accountingDecision: 'CAPITALIZAR' | 'DESPESA';
  newUsefulLifeMonths: number | null;
  notes: string | null;
  createdAt: string;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAssetRenovation(assetId: string) {
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const [loading, setLoading] = useState(false);
  const [renovations, setRenovations] = useState<Renovation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRenovations = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await api.get<Renovation[]>(`/org/${orgId}/assets/${assetId}/renovations`);
      setRenovations(res);
    } catch {
      setError('Nao foi possivel carregar as reformas.');
    }
  }, [orgId, assetId]);

  const createRenovation = useCallback(
    async (input: CreateRenovationInput) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        await api.post<Renovation>(`/org/${orgId}/assets/${assetId}/renovations`, input);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel registrar a reforma.';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [orgId, assetId],
  );

  return { renovations, loading, error, fetchRenovations, createRenovation };
}
