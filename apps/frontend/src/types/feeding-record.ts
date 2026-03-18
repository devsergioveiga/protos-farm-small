export type FeedingShift = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export const FEEDING_SHIFT_OPTIONS: Array<{ value: FeedingShift; label: string }> = [
  { value: 'MORNING', label: 'Manhã' },
  { value: 'AFTERNOON', label: 'Tarde' },
  { value: 'NIGHT', label: 'Noite' },
];

export const FEEDING_SHIFT_LABELS: Record<FeedingShift, string> = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

export type LeftoverAlertType = 'EXCESS' | 'RESTRICTION' | 'NONE';

export const LEFTOVER_ALERT_CONFIG: Record<
  LeftoverAlertType,
  { label: string; className: string }
> = {
  EXCESS: { label: 'Excesso (>10%)', className: 'excess' },
  RESTRICTION: { label: 'Restrição (0%)', className: 'restriction' },
  NONE: { label: 'Normal', className: 'normal' },
};

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
  shift: FeedingShift;
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
  shift: FeedingShift;
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

export interface FeedingRecordsApiResponse {
  data: FeedingRecordListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface FeedingRecordItemInput {
  feedIngredientId: string;
  feedIngredientName: string;
  productId?: string | null;
  quantityProvidedKg: number;
}

export interface CreateFeedingRecordInput {
  lotId: string;
  feedingDate: string;
  shift: FeedingShift;
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
