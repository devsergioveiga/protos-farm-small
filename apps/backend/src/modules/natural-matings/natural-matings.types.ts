// ─── Error ──────────────────────────────────────────────────────────

export class NaturalMatingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'NaturalMatingError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const MATING_REASONS = ['POST_IATF_REPASSE', 'DIRECT_COVERAGE'] as const;
export type MatingReasonValue = (typeof MATING_REASONS)[number];

export const MATING_REASON_LABELS: Record<MatingReasonValue, string> = {
  POST_IATF_REPASSE: 'Repasse pós-IATF',
  DIRECT_COVERAGE: 'Cobertura direta',
};

export function isValidMatingReason(value: string): value is MatingReasonValue {
  return MATING_REASONS.includes(value as MatingReasonValue);
}

export const PATERNITY_TYPES = ['PROBABLE_NATURAL', 'UNKNOWN_BREED_ONLY'] as const;
export type PaternityTypeValue = (typeof PATERNITY_TYPES)[number];

export const PATERNITY_TYPE_LABELS: Record<PaternityTypeValue, string> = {
  PROBABLE_NATURAL: 'Provável — monta natural',
  UNKNOWN_BREED_ONLY: 'Desconhecido — raça informada',
};

export function isValidPaternityType(value: string): value is PaternityTypeValue {
  return PATERNITY_TYPES.includes(value as PaternityTypeValue);
}

export const DEFAULT_MAX_STAY_DAYS = 60;

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateNaturalMatingInput {
  bullId?: string | null;
  bullBreedName?: string | null;
  reason: string;
  entryDate: string; // ISO date
  exitDate?: string | null; // ISO date
  animalIds: string[];
  maxStayDays?: number | null;
  notes?: string | null;
}

export interface UpdateNaturalMatingInput {
  exitDate?: string | null;
  maxStayDays?: number | null;
  notes?: string | null;
  bullId?: string | null;
  bullBreedName?: string | null;
  reason?: string;
  animalIds?: string[];
}

export interface ListNaturalMatingsQuery {
  bullId?: string;
  reason?: MatingReasonValue;
  paternityType?: PaternityTypeValue;
  dateFrom?: string;
  dateTo?: string;
  overstayOnly?: boolean;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface NaturalMatingItem {
  id: string;
  farmId: string;
  bullId: string | null;
  bullName: string | null;
  bullBreedName: string | null;
  reason: MatingReasonValue;
  reasonLabel: string;
  entryDate: string;
  exitDate: string | null;
  maxStayDays: number | null;
  isOverstay: boolean;
  stayDays: number | null;
  paternityType: PaternityTypeValue;
  paternityTypeLabel: string;
  animalCount: number;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface NaturalMatingAnimalItem {
  id: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
}

export interface NaturalMatingDetail extends NaturalMatingItem {
  animals: NaturalMatingAnimalItem[];
}

export interface OverstayAlertItem {
  id: string;
  bullId: string | null;
  bullName: string | null;
  bullBreedName: string | null;
  entryDate: string;
  maxStayDays: number;
  currentStayDays: number;
  daysOverstay: number;
  animalCount: number;
  reason: MatingReasonValue;
  reasonLabel: string;
}

export interface MatingIndicators {
  totalMatings: number;
  activeMatings: number;
  completedMatings: number;
  overstayCount: number;
  avgStayDays: number | null;
  pregnancyRateNaturalPlaceholder: number | null;
  pregnancyRateAiPlaceholder: number | null;
  byReason: {
    reason: MatingReasonValue;
    reasonLabel: string;
    count: number;
  }[];
  periodStart: string;
  periodEnd: string;
}
