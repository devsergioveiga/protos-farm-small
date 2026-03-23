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

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateWeaningInput {
  calfId: string;
  weaningDate: string; // ISO date
  weightKg?: number | null;
  targetLotId?: string | null;
  observations?: string | null;
}

export interface BulkWeaningInput {
  weaningDate: string; // ISO date — shared for all
  targetLotId?: string | null;
  animals: Array<{
    calfId: string;
    weightKg?: number | null;
    observations?: string | null;
  }>;
}

export interface WeaningConfigInput {
  weaningDaysMale?: number | null;
  weaningDaysFemale?: number | null;
  minWeightKgMale?: number | null;
  minWeightKgFemale?: number | null;
}

export interface ListWeaningsQuery {
  calfId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface WeaningItem {
  id: string;
  farmId: string;
  calfId: string;
  calfEarTag: string;
  calfName: string | null;
  weaningDate: string;
  weightKg: number | null;
  targetLotId: string | null;
  observations: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface WeaningConfigItem {
  weaningDaysMale: number | null;
  weaningDaysFemale: number | null;
  minWeightKgMale: number | null;
  minWeightKgFemale: number | null;
}

export interface UnweanedAnimalItem {
  id: string;
  earTag: string;
  name: string | null;
  sex: 'MALE' | 'FEMALE';
  category: string;
  birthDate: string | null;
  ageDays: number | null;
  expectedWeaningDate: string | null;
  isOverdue: boolean;
  lastWeightKg: number | null;
  lastWeighingDate: string | null;
  lotId: string | null;
  lotName: string | null;
}

export interface BulkWeaningResultItem {
  calfId: string;
  calfEarTag: string;
  status: 'created' | 'error';
  weaningId?: string;
  weightWarning?: string | null;
  error?: string;
}
