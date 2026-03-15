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
  responsibleName: string;
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

export interface CreateReleaseInput {
  animalId: string;
  releaseDate: string;
  weightKg?: number | null;
  ageMonths?: number | null;
  bodyConditionScore?: number | null;
  responsibleName: string;
  notes?: string | null;
}

export interface BulkReleaseInput {
  animalIds: string[];
  releaseDate: string;
  responsibleName: string;
  notes?: string | null;
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
