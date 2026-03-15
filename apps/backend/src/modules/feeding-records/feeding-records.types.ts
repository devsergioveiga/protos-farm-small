// ─── Error ──────────────────────────────────────────────────────────

export class FeedingRecordError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FeedingRecordError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const FEEDING_SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT'] as const;
export type FeedingShiftValue = (typeof FEEDING_SHIFTS)[number];

export const FEEDING_SHIFT_LABELS: Record<FeedingShiftValue, string> = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

export const LEFTOVER_ALERT_TYPES = ['EXCESS', 'RESTRICTION', 'NONE'] as const;
export type LeftoverAlertType = (typeof LEFTOVER_ALERT_TYPES)[number];

export const LEFTOVER_ALERT_LABELS: Record<LeftoverAlertType, string> = {
  EXCESS: 'Excesso (>10%) — possível problema de palatabilidade',
  RESTRICTION: 'Restrição (0%) — possível falta de alimento',
  NONE: 'Normal',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface FeedingRecordItemInput {
  feedIngredientId: string;
  feedIngredientName: string;
  productId?: string | null;
  quantityProvidedKg: number;
}

export interface CreateFeedingRecordInput {
  lotId: string;
  feedingDate: string; // ISO date
  shift: FeedingShiftValue;
  dietId?: string | null;
  dietName?: string | null;
  responsibleName: string;
  notes?: string | null;
  items: FeedingRecordItemInput[];
  deductStock?: boolean;
}

export interface RecordLeftoversInput {
  items: Array<{
    feedingRecordItemId: string;
    quantityLeftoverKg: number;
  }>;
  totalLeftoverKg?: number;
}

export interface UpdateFeedingRecordInput {
  responsibleName?: string;
  notes?: string | null;
}

export interface ListFeedingRecordsQuery {
  lotId?: string;
  dateFrom?: string;
  dateTo?: string;
  shift?: string;
  page?: number;
  limit?: number;
}

export interface IndicatorsQuery {
  lotId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface FeedingRecordItemResponse {
  id: string;
  feedingRecordId: string;
  feedIngredientId: string;
  feedIngredientName: string;
  productId: string | null;
  quantityProvidedKg: number;
  quantityLeftoverKg: number | null;
  quantityConsumedKg: number | null;
}

export interface FeedingRecordResponse {
  id: string;
  farmId: string;
  organizationId: string;
  lotId: string;
  lotName: string;
  feedingDate: string;
  shift: FeedingShiftValue;
  shiftLabel: string;
  dietId: string | null;
  dietName: string | null;
  animalCount: number;
  totalProvidedKg: number;
  totalLeftoverKg: number | null;
  totalConsumedKg: number | null;
  leftoverPercent: number | null;
  leftoverAlert: boolean;
  leftoverAlertType: LeftoverAlertType;
  leftoverAlertLabel: string;
  consumptionPerAnimalKg: number | null;
  responsibleName: string;
  stockOutputId: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  items: FeedingRecordItemResponse[];
  createdAt: string;
}

export interface FeedingRecordListItem {
  id: string;
  farmId: string;
  lotId: string;
  lotName: string;
  feedingDate: string;
  shift: FeedingShiftValue;
  shiftLabel: string;
  dietName: string | null;
  animalCount: number;
  totalProvidedKg: number;
  totalLeftoverKg: number | null;
  totalConsumedKg: number | null;
  leftoverPercent: number | null;
  leftoverAlert: boolean;
  leftoverAlertType: LeftoverAlertType;
  consumptionPerAnimalKg: number | null;
  responsibleName: string;
  createdAt: string;
}

export interface ConsumptionIndicators {
  period: { from: string; to: string };
  lotId: string | null;
  lotName: string | null;
  averageDmPerAnimalDay: number | null;
  plannedDmPerAnimalDay: number | null;
  dmVariancePercent: number | null;
  costPerAnimalDay: number | null;
  costPerLiterMilk: number | null;
  consumptionEvolution: Array<{
    date: string;
    totalProvidedKg: number;
    totalConsumedKg: number;
    animalCount: number;
    consumptionPerAnimalKg: number;
  }>;
}
