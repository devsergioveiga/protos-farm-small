// ─── Error ──────────────────────────────────────────────────────────

export class AnimalWeighingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnimalWeighingError';
  }
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateWeighingInput {
  weightKg: number;
  measuredAt: string; // ISO date
  bodyConditionScore?: number | null;
  notes?: string | null;
}

export interface UpdateWeighingInput {
  weightKg?: number;
  measuredAt?: string;
  bodyConditionScore?: number | null;
  notes?: string | null;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface WeighingItem {
  id: string;
  animalId: string;
  farmId: string;
  weightKg: number;
  measuredAt: string;
  bodyConditionScore: number | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface FarmWeighingItem {
  id: string;
  animalId: string;
  earTag: string;
  animalName: string | null;
  weightKg: number;
  measuredAt: string;
  bodyConditionScore: number | null;
  notes: string | null;
  recorderName: string;
}

export type FarmWeighingSortField = 'measuredAt' | 'earTag' | 'animalName' | 'weightKg' | 'bodyConditionScore' | 'recorderName';

export interface ListFarmWeighingsQuery {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  lotId?: string;
  sortBy?: FarmWeighingSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface WeighingStats {
  currentWeightKg: number | null;
  entryWeightKg: number | null;
  totalGainKg: number | null;
  gmdKgDay: number | null;
  minWeightKg: number | null;
  maxWeightKg: number | null;
  totalWeighings: number;
}
