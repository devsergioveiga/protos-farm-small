import type { PaginationMeta } from './admin';

export interface CriteriaItem {
  minWeightKg: number | null;
  minAgeMonths: number | null;
  minBodyScore: number | null;
  targetLotId: string | null;
}

export interface CandidateItem {
  animalId: string;
  earTag: string;
  animalName: string | null;
  category: string;
  birthDate: string | null;
  ageMonths: number | null;
  lastWeightKg: number | null;
  lastWeighingDate: string | null;
  bodyConditionScore: number | null;
  meetsWeight: boolean;
  meetsAge: boolean;
  meetsScore: boolean;
  meetsAll: boolean;
}

export interface ReleaseItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  releaseDate: string;
  weightKg: number | null;
  ageMonths: number | null;
  bodyConditionScore: number | null;
  previousCategory: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface ReleaseIndicators {
  avgAgeMonths: number | null;
  avgWeightKg: number | null;
  avgRearingDays: number | null;
  totalReleased: number;
}

export interface ReleaseVaccinationInput {
  productId?: string | null;
  productName: string;
  dosageMl: number;
  administrationRoute: string;
  productBatchNumber?: string | null;
}

export interface ReleaseIatfInput {
  protocolId: string;
  lotName?: string | null;
}

export interface CreateReleaseInput {
  animalId: string;
  releaseDate: string;
  weightKg?: number | null;
  ageMonths?: number | null;
  bodyConditionScore?: number | null;
  notes?: string | null;
  vaccination?: ReleaseVaccinationInput | null;
  iatf?: ReleaseIatfInput | null;
}

export interface BulkReleaseInput {
  animals: Array<{
    animalId: string;
    weightKg?: number | null;
  }>;
  releaseDate: string;
  targetLotId?: string | null;
  notes?: string | null;
  vaccination?: ReleaseVaccinationInput | null;
  iatf?: ReleaseIatfInput | null;
}

export interface SetCriteriaInput {
  minWeightKg?: number | null;
  minAgeMonths?: number | null;
  minBodyScore?: number | null;
  targetLotId?: string | null;
}

export interface ReleasesResponse {
  data: ReleaseItem[];
  meta: PaginationMeta;
}
