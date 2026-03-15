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

export interface CreateReleaseInput {
  animalId: string;
  releaseDate: string; // ISO date
  weightKg?: number | null;
  ageMonths?: number | null;
  bodyConditionScore?: number | null; // 1.0 to 5.0
  responsibleName: string;
  targetLotId?: string | null;
  notes?: string | null;
}

export interface BulkReleaseInput {
  animalIds: string[];
  releaseDate: string; // ISO date
  responsibleName: string;
  targetLotId?: string | null;
  notes?: string | null;
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
  responsibleName: string;
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
  name: string | null;
  category: string;
  birthDate: string | null;
  ageMonths: number | null;
  latestWeightKg: number | null;
  latestWeighingDate: string | null;
  bodyConditionScore: number | null;
  lotId: string | null;
  lotName: string | null;
  meetsCriteria: boolean;
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
