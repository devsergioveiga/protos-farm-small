export interface MatingPlanItem {
  id: string;
  farmId: string;
  name: string;
  season: string | null;
  objective: string | null;
  status: string;
  statusLabel: string;
  startDate: string | null;
  endDate: string | null;
  pairCount: number;
  executedCount: number;
  confirmedCount: number;
  notes: string | null;
  createdBy: string;
  creatorName: string;
  createdAt: string;
}

export interface MatingPairItem {
  id: string;
  planId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  animalBreed: string | null;
  primaryBullId: string | null;
  primaryBullName: string | null;
  secondaryBullId: string | null;
  secondaryBullName: string | null;
  tertiaryBullId: string | null;
  tertiaryBullName: string | null;
  status: string;
  statusLabel: string;
  executedBullId: string | null;
  executedBullName: string | null;
  executionDate: string | null;
  substitutionReason: string | null;
  notes: string | null;
}

export interface MatingPlanDetail extends MatingPlanItem {
  pairs: MatingPairItem[];
}

export interface AdherenceReport {
  totalExecuted: number;
  followedPlan: number;
  substituted: number;
  adherencePercent: number;
  substitutionReasons: Array<{ reason: string; count: number }>;
}

export interface MatingPlansResponse {
  data: MatingPlanItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateMatingPlanInput {
  name: string;
  season: string | null;
  objective: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
}

export interface UpdateMatingPlanInput {
  name?: string;
  season?: string | null;
  objective?: string | null;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export interface AddMatingPairInput {
  animalId: string;
  primaryBullId: string | null;
  secondaryBullId: string | null;
  tertiaryBullId: string | null;
  notes: string | null;
}

export interface UpdateMatingPairInput {
  status: string;
  executedBullId?: string | null;
  executionDate?: string | null;
  substitutionReason?: string | null;
  notes?: string | null;
}

export const MATING_PLAN_STATUSES = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'CANCELLED', label: 'Cancelado' },
] as const;

export const MATING_PAIR_STATUSES = [
  { value: 'PLANNED', label: 'Planejado' },
  { value: 'EXECUTED', label: 'Executado' },
  { value: 'CONFIRMED_PREGNANT', label: 'Prenha confirmada' },
  { value: 'EMPTY', label: 'Vazia' },
  { value: 'CANCELLED', label: 'Cancelado' },
] as const;

export const PLAN_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Rascunho', className: 'plan-status--draft' },
  ACTIVE: { label: 'Ativo', className: 'plan-status--active' },
  COMPLETED: { label: 'Concluído', className: 'plan-status--completed' },
  CANCELLED: { label: 'Cancelado', className: 'plan-status--cancelled' },
};

export const PAIR_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PLANNED: { label: 'Planejado', className: 'pair-status--planned' },
  EXECUTED: { label: 'Executado', className: 'pair-status--executed' },
  CONFIRMED_PREGNANT: { label: 'Prenha confirmada', className: 'pair-status--pregnant' },
  EMPTY: { label: 'Vazia', className: 'pair-status--empty' },
  CANCELLED: { label: 'Cancelado', className: 'pair-status--cancelled' },
};
