// ─── Error ──────────────────────────────────────────────────────────

export class ReproductiveReleaseError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ReproductiveReleaseError';
  }
}

// ─── Input Types ────────────────────────────────────────────────────

export interface ReleaseVaccinationInput {
  productId?: string | null;
  productName: string;
  dosageMl: number;
  administrationRoute: string; // IM, SC, IV, ORAL, etc.
  productBatchNumber?: string | null;
}

export interface ReleaseIatfInput {
  protocolId: string;
  lotName?: string | null;
}

export interface CreateReleaseInput {
  animalId: string;
  releaseDate: string; // ISO date
  weightKg?: number | null;
  ageMonths?: number | null;
  bodyConditionScore?: number | null; // 1.0 to 5.0
  targetLotId?: string | null;
  notes?: string | null;
  vaccination?: ReleaseVaccinationInput | null;
  iatf?: ReleaseIatfInput | null;
}

export interface BulkReleaseAnimalInput {
  animalId: string;
  weightKg?: number | null;
}

export interface BulkReleaseInput {
  animals: BulkReleaseAnimalInput[];
  releaseDate: string; // ISO date
  targetLotId?: string | null;
  notes?: string | null;
  vaccination?: ReleaseVaccinationInput | null;
  iatf?: ReleaseIatfInput | null;
  /** @deprecated Use animals[] instead */
  animalIds?: string[];
}

export interface SetCriteriaInput {
  minWeightKg?: number | null;
  minAgeMonths?: number | null;
  minBodyScore?: number | null;
  targetLotId?: string | null;
}

export interface ListReleasesQuery {
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

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
  previousLotId: string | null;
  previousLotName: string | null;
  targetLotId: string | null;
  targetLotName: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface CriteriaItem {
  id: string;
  organizationId: string;
  minWeightKg: number | null;
  minAgeMonths: number | null;
  minBodyScore: number | null;
  targetLotId: string | null;
  targetLotName: string | null;
  createdAt: string;
  updatedAt: string;
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
  lotId: string | null;
  lotName: string | null;
  meetsWeight: boolean;
  meetsAge: boolean;
  meetsScore: boolean;
  meetsAll: boolean;
}

export interface BulkReleaseResult {
  released: number;
  failed: number;
  errors: Array<{ animalId: string; reason: string }>;
}

export interface ReleaseIndicators {
  totalReleased: number;
  avgAgeMonths: number | null;
  avgWeightKg: number | null;
  avgRearingTimeDays: number | null;
}
