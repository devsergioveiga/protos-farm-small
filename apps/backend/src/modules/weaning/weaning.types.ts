// ─── Error ──────────────────────────────────────────────────────────

export class WeaningError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'WeaningError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const FEED_TYPES = ['WHOLE_MILK', 'PASTEURIZED_DISCARD_MILK', 'MILK_REPLACER'] as const;
export type FeedTypeValue = (typeof FEED_TYPES)[number];

export const FEED_TYPE_LABELS: Record<FeedTypeValue, string> = {
  WHOLE_MILK: 'Leite integral',
  PASTEURIZED_DISCARD_MILK: 'Leite de descarte pasteurizado',
  MILK_REPLACER: 'Sucedâneo lácteo',
};

export function isValidFeedType(value: string): value is FeedTypeValue {
  return FEED_TYPES.includes(value as FeedTypeValue);
}

export const FEEDING_METHODS = ['BUCKET_NIPPLE', 'BOTTLE', 'FOSTER_COLLECTIVE'] as const;
export type FeedingMethodValue = (typeof FEEDING_METHODS)[number];

export const FEEDING_METHOD_LABELS: Record<FeedingMethodValue, string> = {
  BUCKET_NIPPLE: 'Balde com bico',
  BOTTLE: 'Mamadeira',
  FOSTER_COLLECTIVE: 'Aleitamento coletivo',
};

export function isValidFeedingMethod(value: string): value is FeedingMethodValue {
  return FEEDING_METHODS.includes(value as FeedingMethodValue);
}

export const DESTINATIONS = ['CALF_PEN', 'INDIVIDUAL_STALL', 'CALF_PADDOCK'] as const;
export type DestinationValue = (typeof DESTINATIONS)[number];

export const DESTINATION_LABELS: Record<DestinationValue, string> = {
  CALF_PEN: 'Bezerreiro',
  INDIVIDUAL_STALL: 'Baia individual',
  CALF_PADDOCK: 'Piquete de bezerros',
};

export function isValidDestination(value: string): value is DestinationValue {
  return DESTINATIONS.includes(value as DestinationValue);
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateSeparationInput {
  calfId: string;
  motherId: string;
  separationDate: string; // ISO date
  reason?: string | null;
  destination?: string | null;
}

export interface SetFeedingProtocolInput {
  feedType: string;
  dailyVolumeLiters: number;
  frequencyPerDay?: number;
  feedingMethod: string;
  concentrateStartDate?: string | null;
  concentrateGramsPerDay?: number | null;
  roughageType?: string | null;
  targetWeaningWeightKg?: number | null;
  notes?: string | null;
}

export interface CreateWeaningInput {
  calfId: string;
  weaningDate: string; // ISO date
  weightKg?: number | null;
  ageMonths?: number | null;
  concentrateConsumptionGrams?: number | null;
  targetLotId?: string | null;
  observations?: string | null;
}

export interface SetCriteriaInput {
  minAgeDays?: number | null;
  minWeightKg?: number | null;
  minConcentrateGrams?: number | null;
  consecutiveDays?: number | null;
  targetLotId?: string | null;
}

export interface ListSeparationsQuery {
  calfId?: string;
  motherId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface ListWeaningsQuery {
  calfId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface FeedingProtocolItem {
  id: string;
  separationId: string;
  feedType: FeedTypeValue;
  feedTypeLabel: string;
  dailyVolumeLiters: number;
  frequencyPerDay: number;
  feedingMethod: FeedingMethodValue;
  feedingMethodLabel: string;
  concentrateStartDate: string | null;
  concentrateGramsPerDay: number | null;
  roughageType: string | null;
  targetWeaningWeightKg: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeparationItem {
  id: string;
  farmId: string;
  calfId: string;
  calfEarTag: string;
  calfName: string | null;
  motherId: string;
  motherEarTag: string;
  motherName: string | null;
  separationDate: string;
  reason: string | null;
  destination: string | null;
  destinationLabel: string | null;
  feedingProtocol: FeedingProtocolItem | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface WeaningItem {
  id: string;
  farmId: string;
  calfId: string;
  calfEarTag: string;
  calfName: string | null;
  weaningDate: string;
  weightKg: number | null;
  ageMonths: number | null;
  concentrateConsumptionGrams: number | null;
  previousCategory: string | null;
  targetLotId: string | null;
  observations: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface WeaningCriteriaItem {
  id: string;
  organizationId: string;
  minAgeDays: number | null;
  minWeightKg: number | null;
  minConcentrateGrams: number | null;
  consecutiveDays: number | null;
  targetLotId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeaningCandidateItem {
  calfId: string;
  calfEarTag: string;
  calfName: string | null;
  birthDate: string | null;
  ageDays: number | null;
  currentWeightKg: number | null;
  motherId: string;
  motherEarTag: string;
  meetsAge: boolean;
  meetsWeight: boolean;
  meetsAllCriteria: boolean;
}

export interface WeaningIndicators {
  totalWeanings: number;
  avgWeaningWeightKg: number | null;
  avgWeaningAgeMonths: number | null;
  totalSeparations: number;
  nursingCalves: number;
  mortalityRate: number | null;
  feedingCostPlaceholder: number | null;
  periodStart: string;
  periodEnd: string;
}
