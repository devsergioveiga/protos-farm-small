// ─── Error ──────────────────────────────────────────────────────────

export class AnimalError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnimalError';
  }
}

// ─── Constants ──────────────────────────────────────────────────────

export const ANIMAL_SEXES = ['MALE', 'FEMALE'] as const;
export type AnimalSexType = (typeof ANIMAL_SEXES)[number];

export const ANIMAL_CATEGORIES = [
  'BEZERRO',
  'BEZERRA',
  'NOVILHA',
  'NOVILHO',
  'VACA_LACTACAO',
  'VACA_SECA',
  'TOURO_REPRODUTOR',
  'DESCARTE',
] as const;
export type AnimalCategoryType = (typeof ANIMAL_CATEGORIES)[number];

export const ANIMAL_ORIGINS = ['BORN', 'PURCHASED'] as const;

export const GENEALOGY_CLASSES = [
  'PO',
  'PC_OC',
  'PC_OD',
  'GC_01',
  'GC_02',
  'GC_03',
  'PA',
  'LA',
  'CCG',
  'SRD',
] as const;

export const BODY_CONDITION_SCORE_MIN = 1;
export const BODY_CONDITION_SCORE_MAX = 5;

export const BREED_CATEGORIES = ['LEITEIRA', 'CORTE', 'DUPLA_APTIDAO'] as const;

// Girolando grade detection: Holandesa % → grade
export const GIROLANDO_GRADES: Record<string, string> = {
  '50.00': 'F1',
  '75.00': '3/4',
  '62.50': '5/8',
  '37.50': '3/8',
  '87.50': '7/8',
};

// Common blood fractions
export const BLOOD_FRACTIONS = [
  '1/2',
  '1/4',
  '3/4',
  '1/8',
  '3/8',
  '5/8',
  '7/8',
  '1/16',
  '15/16',
] as const;

// ─── Input types ────────────────────────────────────────────────────

export interface BreedCompositionInput {
  breedId: string;
  percentage: number;
  fraction?: string;
}

export interface GenealogicalRecordInput {
  genealogyClass: string;
  registrationNumber?: string;
  associationName?: string;
  registrationDate?: string;
  girolando_grade?: string;
  notes?: string;
}

export interface CreateAnimalInput {
  earTag: string;
  rfidTag?: string;
  name?: string;
  sex: string;
  birthDate?: string;
  birthDateEstimated?: boolean;
  category?: string;
  origin?: string;
  entryWeightKg?: number;
  bodyConditionScore?: number;
  sireId?: string;
  damId?: string;
  photoUrl?: string;
  notes?: string;
  isCompositionEstimated?: boolean;
  compositions?: BreedCompositionInput[];
  genealogicalRecords?: GenealogicalRecordInput[];
}

export interface UpdateAnimalInput {
  earTag?: string;
  rfidTag?: string;
  name?: string;
  sex?: string;
  birthDate?: string;
  birthDateEstimated?: boolean;
  category?: string;
  origin?: string;
  entryWeightKg?: number;
  bodyConditionScore?: number;
  sireId?: string | null;
  damId?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  isCompositionEstimated?: boolean;
  compositions?: BreedCompositionInput[];
  genealogicalRecords?: GenealogicalRecordInput[];
}

export interface ListAnimalsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sex?: string;
  category?: string;
  breedId?: string;
  origin?: string;
}

export interface CreateBreedInput {
  name: string;
  code?: string;
  species?: string;
  category?: string;
}
