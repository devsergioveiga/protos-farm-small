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

export interface WeaningsResponse {
  data: WeaningItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateWeaningInput {
  calfId: string;
  weaningDate: string;
  weightKg?: number | null;
  targetLotId?: string | null;
  observations?: string | null;
}

export interface WeaningConfig {
  weaningDaysMale: number | null;
  weaningDaysFemale: number | null;
  minWeightKgMale: number | null;
  minWeightKgFemale: number | null;
}

export interface UnweanedAnimal {
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

export interface BulkWeaningInput {
  weaningDate: string;
  targetLotId?: string | null;
  animals: Array<{
    calfId: string;
    weightKg?: number | null;
    observations?: string | null;
  }>;
}

export interface BulkWeaningResultItem {
  calfId: string;
  calfEarTag: string;
  status: 'created' | 'error';
  weaningId?: string;
  weightWarning?: string | null;
  error?: string;
}
