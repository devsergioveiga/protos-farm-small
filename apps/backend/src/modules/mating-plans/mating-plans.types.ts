// ─── Error ──────────────────────────────────────────────────────────

export class MatingPlanError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MatingPlanError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const MATING_PLAN_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type MatingPlanStatusValue = (typeof MATING_PLAN_STATUSES)[number];

export const MATING_PLAN_STATUS_LABELS: Record<MatingPlanStatusValue, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export function isValidMatingPlanStatus(value: string): value is MatingPlanStatusValue {
  return MATING_PLAN_STATUSES.includes(value as MatingPlanStatusValue);
}

export const MATING_PAIR_STATUSES = [
  'PLANNED',
  'EXECUTED',
  'CONFIRMED_PREGNANT',
  'EMPTY',
  'CANCELLED',
] as const;
export type MatingPairStatusValue = (typeof MATING_PAIR_STATUSES)[number];

export const MATING_PAIR_STATUS_LABELS: Record<MatingPairStatusValue, string> = {
  PLANNED: 'Planejado',
  EXECUTED: 'Executado',
  CONFIRMED_PREGNANT: 'Confirmada prenhe',
  EMPTY: 'Vazia (replanej.)',
  CANCELLED: 'Cancelado',
};

export function isValidMatingPairStatus(value: string): value is MatingPairStatusValue {
  return MATING_PAIR_STATUSES.includes(value as MatingPairStatusValue);
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreatePlanInput {
  name: string;
  season?: string | null;
  objective?: string | null;
  status?: MatingPlanStatusValue;
  startDate?: string | null; // ISO date
  endDate?: string | null;
  notes?: string | null;
}

export interface UpdatePlanInput {
  name?: string;
  season?: string | null;
  objective?: string | null;
  status?: MatingPlanStatusValue;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export interface AddPairInput {
  animalId: string;
  primaryBullId?: string | null;
  secondaryBullId?: string | null;
  tertiaryBullId?: string | null;
  notes?: string | null;
}

export interface UpdatePairInput {
  primaryBullId?: string | null;
  secondaryBullId?: string | null;
  tertiaryBullId?: string | null;
  status?: MatingPairStatusValue;
  executedBullId?: string | null;
  executionDate?: string | null;
  substitutionReason?: string | null;
  notes?: string | null;
}

export interface ListPlansQuery {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ImportPairsInput {
  rows: {
    earTag: string;
    primaryBullName?: string | null;
    secondaryBullName?: string | null;
    tertiaryBullName?: string | null;
  }[];
}

// ─── Response Types ─────────────────────────────────────────────────

export interface MatingPlanItem {
  id: string;
  organizationId: string;
  farmId: string;
  name: string;
  season: string | null;
  objective: string | null;
  status: MatingPlanStatusValue;
  statusLabel: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdBy: string;
  creatorName: string | null;
  pairsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MatingPairItem {
  id: string;
  planId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  primaryBullId: string | null;
  primaryBullName: string | null;
  secondaryBullId: string | null;
  secondaryBullName: string | null;
  tertiaryBullId: string | null;
  tertiaryBullName: string | null;
  status: MatingPairStatusValue;
  statusLabel: string;
  executedBullId: string | null;
  executedBullName: string | null;
  executionDate: string | null;
  substitutionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatingPlanDetail extends MatingPlanItem {
  pairs: MatingPairItem[];
}

export interface AdherenceReport {
  planId: string;
  planName: string;
  totalPairs: number;
  executedPairs: number;
  followedPlan: number;
  substituted: number;
  adherenceRate: number; // percentage 0-100
  pending: number;
  cancelled: number;
  confirmedPregnant: number;
  empty: number;
}

export interface ImportPairsResult {
  imported: number;
  skipped: number;
  errors: string[];
}
