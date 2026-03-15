export interface NaturalMatingItem {
  id: string;
  farmId: string;
  bullId: string | null;
  bullName: string | null;
  bullBreedName: string | null;
  reason: string;
  reasonLabel: string;
  entryDate: string;
  exitDate: string | null;
  maxStayDays: number | null;
  isOverstay: boolean;
  paternityType: string;
  paternityTypeLabel: string;
  animalCount: number;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface NaturalMatingDetail extends NaturalMatingItem {
  animals: Array<{
    id: string;
    animalId: string;
    earTag: string;
    animalName: string | null;
  }>;
}

export interface OverstayAlert {
  matingId: string;
  bullName: string | null;
  entryDate: string;
  daysInLot: number;
  maxStayDays: number;
  animalCount: number;
}

export interface MatingIndicators {
  totalNaturalMatings: number;
  activeBullsInLot: number;
  avgStayDays: number | null;
}

export interface NaturalMatingsResponse {
  data: NaturalMatingItem[];
  total: number;
}

export interface CreateNaturalMatingInput {
  bullId: string | null;
  bullBreedName: string | null;
  reason: string;
  entryDate: string;
  exitDate: string | null;
  maxStayDays: number | null;
  animalIds: string[];
  notes: string | null;
}

export interface UpdateNaturalMatingInput {
  exitDate?: string | null;
  notes?: string | null;
}

export const MATING_REASONS = [
  { value: 'POST_IATF_REPASSE', label: 'Repasse pos-IATF' },
  { value: 'DIRECT_COVERAGE', label: 'Cobertura direta' },
] as const;

export const REASON_CONFIG = {
  POST_IATF_REPASSE: { label: 'Repasse pos-IATF', className: 'reason--repasse' },
  DIRECT_COVERAGE: { label: 'Cobertura direta', className: 'reason--direct' },
} as const;
