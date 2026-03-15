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
  feedingProtocol: FeedingProtocolItem | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface FeedingProtocolItem {
  id: string;
  feedType: string;
  feedTypeLabel: string;
  dailyVolumeLiters: number;
  frequencyPerDay: number;
  feedingMethod: string;
  feedingMethodLabel: string;
  concentrateStartDate: string | null;
  concentrateGramsPerDay: number | null;
  roughageType: string | null;
  targetWeaningWeightKg: number | null;
}

export interface WeaningCandidateItem {
  calfId: string;
  earTag: string;
  calfName: string | null;
  birthDate: string | null;
  ageDays: number | null;
  lastWeightKg: number | null;
  meetsAge: boolean;
  meetsWeight: boolean;
  meetsAll: boolean;
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
  observations: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface WeaningIndicators {
  totalWeaned: number;
  avgWeightKg: number | null;
  avgAgeMonths: number | null;
  mortalityRate: number | null;
}

export interface WeaningCriteria {
  minAgeDays: number | null;
  minWeightKg: number | null;
  minConcentrateGrams: number | null;
  consecutiveDays: number | null;
  targetLotId: string | null;
}

export interface SeparationsResponse {
  data: SeparationItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface WeaningsResponse {
  data: WeaningItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateSeparationInput {
  calfId: string;
  motherId: string;
  separationDate: string;
  reason?: string | null;
  destination?: string | null;
}

export interface FeedingProtocolInput {
  feedType: string;
  dailyVolumeLiters: number;
  frequencyPerDay: number;
  feedingMethod: string;
  concentrateStartDate?: string | null;
  concentrateGramsPerDay?: number | null;
  roughageType?: string | null;
  targetWeaningWeightKg?: number | null;
}

export interface CreateWeaningInput {
  calfId: string;
  weaningDate: string;
  weightKg?: number | null;
  ageMonths?: number | null;
  concentrateConsumptionGrams?: number | null;
  observations?: string | null;
}

export const FEED_TYPES = [
  { value: 'WHOLE_MILK', label: 'Leite integral' },
  { value: 'PASTEURIZED_DISCARD_MILK', label: 'Leite de descarte pasteurizado' },
  { value: 'MILK_REPLACER', label: 'Sucedâneo/Substituto lácteo' },
] as const;

export const FEEDING_METHODS = [
  { value: 'BUCKET_NIPPLE', label: 'Balde com bico' },
  { value: 'BOTTLE', label: 'Mamadeira' },
  { value: 'FOSTER_COLLECTIVE', label: 'Foster/Coletivo' },
] as const;
