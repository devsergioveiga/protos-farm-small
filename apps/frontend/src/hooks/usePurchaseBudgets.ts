import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PurchaseBudgetCategory =
  | 'SEMENTE'
  | 'FERTILIZANTE'
  | 'DEFENSIVO'
  | 'COMBUSTIVEL'
  | 'MANUTENCAO'
  | 'EQUIPAMENTO'
  | 'SERVICO'
  | 'VETERINARIO'
  | 'NUTRICAO_ANIMAL'
  | 'INFRAESTRUTURA'
  | 'OUTROS';

export const CATEGORY_LABELS: Record<PurchaseBudgetCategory | string, string> = {
  SEMENTE: 'Sementes',
  FERTILIZANTE: 'Fertilizantes',
  DEFENSIVO: 'Defensivos',
  COMBUSTIVEL: 'Combustível',
  MANUTENCAO: 'Manutenção',
  EQUIPAMENTO: 'Equipamentos',
  SERVICO: 'Serviços',
  VETERINARIO: 'Veterinário',
  NUTRICAO_ANIMAL: 'Nutrição animal',
  INFRAESTRUTURA: 'Infraestrutura',
  OUTROS: 'Outros',
};

export type BudgetPeriodType = 'MENSAL' | 'TRIMESTRAL' | 'SAFRA' | 'ANUAL';

export interface PurchaseBudget {
  id: string;
  category: string;
  periodType: BudgetPeriodType;
  periodStart: string;
  periodEnd: string;
  budgetedAmount: number;
  farmId: string | null;
  farmName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetExecutionRow {
  budgetId: string;
  category: string;
  categoryLabel: string;
  farmId: string | null;
  farmName: string | null;
  periodStart: string;
  periodEnd: string;
  budgetedAmount: number;
  requisitado: number;
  comprado: number;
  pago: number;
  percentUsed: number;
}

export interface BudgetDeviation extends BudgetExecutionRow {
  excedente: number;
  percentExcedido: number;
  contributions?: Array<{
    type: 'RC' | 'OC';
    id: string;
    number: string;
    amount: number;
    date: string;
  }>;
}

export interface CreatePurchaseBudgetInput {
  category: string;
  periodType: BudgetPeriodType;
  periodStart: string;
  periodEnd: string;
  budgetedAmount: number;
  farmId?: string;
}

export interface UpdatePurchaseBudgetInput {
  budgetedAmount?: number;
  periodStart?: string;
  periodEnd?: string;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

interface BudgetListFilters {
  farmId?: string;
  category?: string;
  periodType?: string;
}

interface BudgetExecutionFilters {
  farmId?: string;
  periodStart?: string;
  periodEnd?: string;
}

// ─── usePurchaseBudgets ──────────────────────────────────────────────────────

interface UsePurchaseBudgetsResult {
  budgets: PurchaseBudget[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePurchaseBudgets(filters: BudgetListFilters = {}): UsePurchaseBudgetsResult {
  const [budgets, setBudgets] = useState<PurchaseBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { farmId, category, periodType } = filters;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (farmId) params.set('farmId', farmId);
        if (category) params.set('category', category);
        if (periodType) params.set('periodType', periodType);

        const qs = params.toString();
        const data = await api.get<PurchaseBudget[]>(`/org/purchase-budgets${qs ? `?${qs}` : ''}`);
        if (!cancelled) setBudgets(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar orçamentos');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [farmId, category, periodType, refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { budgets, isLoading, error, refetch };
}

// ─── useBudgetExecution ──────────────────────────────────────────────────────

interface UseBudgetExecutionResult {
  execution: BudgetExecutionRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBudgetExecution(filters: BudgetExecutionFilters = {}): UseBudgetExecutionResult {
  const [execution, setExecution] = useState<BudgetExecutionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { farmId, periodStart, periodEnd } = filters;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (farmId) params.set('farmId', farmId);
        if (periodStart) params.set('periodStart', periodStart);
        if (periodEnd) params.set('periodEnd', periodEnd);

        const qs = params.toString();
        const data = await api.get<BudgetExecutionRow[]>(
          `/org/purchase-budgets/execution${qs ? `?${qs}` : ''}`,
        );
        if (!cancelled) setExecution(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar execução orçamentária');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [farmId, periodStart, periodEnd, refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { execution, isLoading, error, refetch };
}

// ─── useBudgetDeviations ─────────────────────────────────────────────────────

interface UseBudgetDeviationsResult {
  deviations: BudgetDeviation[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBudgetDeviations(
  filters: BudgetExecutionFilters = {},
): UseBudgetDeviationsResult {
  const [deviations, setDeviations] = useState<BudgetDeviation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { farmId, periodStart, periodEnd } = filters;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (farmId) params.set('farmId', farmId);
        if (periodStart) params.set('periodStart', periodStart);
        if (periodEnd) params.set('periodEnd', periodEnd);

        const qs = params.toString();
        const data = await api.get<BudgetDeviation[]>(
          `/org/purchase-budgets/deviations${qs ? `?${qs}` : ''}`,
        );
        if (!cancelled) setDeviations(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar desvios');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [farmId, periodStart, periodEnd, refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { deviations, isLoading, error, refetch };
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function createPurchaseBudget(
  input: CreatePurchaseBudgetInput,
): Promise<PurchaseBudget> {
  return api.post<PurchaseBudget>('/org/purchase-budgets', input);
}

export async function updatePurchaseBudget(
  id: string,
  input: UpdatePurchaseBudgetInput,
): Promise<PurchaseBudget> {
  return api.put<PurchaseBudget>(`/org/purchase-budgets/${id}`, input);
}

export async function deletePurchaseBudget(id: string): Promise<void> {
  return api.delete<void>(`/org/purchase-budgets/${id}`);
}
