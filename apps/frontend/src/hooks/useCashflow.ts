import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types (mirror backend cashflow.types.ts) ────────────────────────

export interface ProjectionPoint {
  date: string;
  label: string;
  balanceRealistic: number;
  balanceOptimistic: number;
  balancePessimistic: number;
  inflows: number;
  outflows: number;
  checksPending: number;
}

export interface DfcEntry {
  category: string;
  dfcClass: 'OPERACIONAL' | 'INVESTIMENTO' | 'FINANCIAMENTO';
  monthlyAmounts: number[];
  total: number;
}

export interface DfcSummary {
  inflows: DfcEntry[];
  outflows: DfcEntry[];
  operacional: { totalInflows: number; totalOutflows: number; net: number };
  investimento: { totalInflows: number; totalOutflows: number; net: number };
  financiamento: { totalInflows: number; totalOutflows: number; net: number };
}

export interface CashflowProjection {
  currentBalance: number;
  projectionPoints: ProjectionPoint[];
  negativeBalanceDate: string | null;
  negativeBalanceAmount: number | null;
  dfc: DfcSummary;
}

export interface NegativeBalanceAlert {
  date: string;
  amount: number;
}

// ─── Hooks ───────────────────────────────────────────────────────────

interface UseCashflowResult {
  projection: CashflowProjection | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCashflow(farmId?: string): UseCashflowResult {
  const [projection, setProjection] = useState<CashflowProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjection = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (farmId) query.set('farmId', farmId);
      const qs = query.toString();
      const path = `/org/cashflow/projection${qs ? `?${qs}` : ''}`;
      const result = await api.get<CashflowProjection>(path);
      setProjection(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar projeção de fluxo de caixa';
      setError(message);
      setProjection(null);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchProjection();
  }, [fetchProjection]);

  return { projection, loading, error, refetch: fetchProjection };
}

interface UseNegativeBalanceAlertResult {
  alert: NegativeBalanceAlert | null;
  loading: boolean;
}

export function useNegativeBalanceAlert(farmId?: string): UseNegativeBalanceAlertResult {
  const [alert, setAlert] = useState<NegativeBalanceAlert | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlert = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (farmId) query.set('farmId', farmId);
      const qs = query.toString();
      const path = `/org/cashflow/negative-balance-alert${qs ? `?${qs}` : ''}`;
      const result = await api.get<{
        negativeBalanceDate: string | null;
        negativeBalanceAmount: number | null;
      }>(path);
      if (result.negativeBalanceDate !== null && result.negativeBalanceAmount !== null) {
        setAlert({ date: result.negativeBalanceDate, amount: result.negativeBalanceAmount });
      } else {
        setAlert(null);
      }
    } catch {
      setAlert(null);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchAlert();
  }, [fetchAlert]);

  return { alert, loading };
}

// ─── Export utilities ─────────────────────────────────────────────────

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportCashflowPdf(farmId?: string): Promise<void> {
  try {
    const query = new URLSearchParams();
    if (farmId) query.set('farmId', farmId);
    const qs = query.toString();
    const path = `/org/cashflow/projection/export/pdf${qs ? `?${qs}` : ''}`;
    const blob = await api.getBlob(path);
    triggerBlobDownload(blob, 'fluxo-de-caixa.pdf');
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Nao foi possivel exportar. Tente novamente.';
    throw new Error(message);
  }
}

export async function exportCashflowExcel(farmId?: string): Promise<void> {
  try {
    const query = new URLSearchParams();
    if (farmId) query.set('farmId', farmId);
    const qs = query.toString();
    const path = `/org/cashflow/projection/export/excel${qs ? `?${qs}` : ''}`;
    const blob = await api.getBlob(path);
    triggerBlobDownload(blob, 'fluxo-de-caixa.xlsx');
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Nao foi possivel exportar. Tente novamente.';
    throw new Error(message);
  }
}
