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

export const ANIMAL_SORT_FIELDS = [
  'earTag',
  'name',
  'birthDate',
  'entryWeightKg',
  'createdAt',
] as const;
export type AnimalSortField = (typeof ANIMAL_SORT_FIELDS)[number];

export interface ListAnimalsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sex?: string;
  category?: string;
  breedId?: string;
  origin?: string;
  lotId?: string;
  birthDateFrom?: string;
  birthDateTo?: string;
  minWeightKg?: number;
  maxWeightKg?: number;
  minAgeDays?: number;
  maxAgeDays?: number;
  sortBy?: AnimalSortField;
  sortOrder?: 'asc' | 'desc';
}

export const ANIMAL_SEX_LABELS_PT: Record<string, string> = {
  MALE: 'Macho',
  FEMALE: 'Fêmea',
};

export const ANIMAL_ORIGIN_LABELS_PT: Record<string, string> = {
  BORN: 'Nascido',
  PURCHASED: 'Comprado',
};

export const ANIMAL_CSV_HEADERS = [
  'Brinco',
  'Nome',
  'Sexo',
  'Nascimento',
  'Categoria',
  'Origem',
  'Raça(s)',
  'Peso Entrada (kg)',
  'ECC',
  'Lote',
  'Pai',
  'Mãe',
  'RFID',
  'Observações',
] as const;

export interface CreateBreedInput {
  name: string;
  code?: string;
  species?: string;
  category?: string;
}

// ─── Bulk Import ────────────────────────────────────────────────────

export interface AnimalColumnMapping {
  earTag?: string;
  name?: string;
  sex?: string;
  birthDate?: string;
  category?: string;
  origin?: string;
  breed1?: string;
  breed2?: string;
  breed3?: string;
  pct1?: string;
  pct2?: string;
  pct3?: string;
  entryWeightKg?: string;
  bodyConditionScore?: string;
  sireEarTag?: string;
  damEarTag?: string;
  rfidTag?: string;
  notes?: string;
}

export interface AnimalBulkPreviewRow {
  index: number;
  parsed: {
    earTag?: string;
    name?: string;
    sex?: string;
    birthDate?: string;
    category?: string;
    origin?: string;
    breeds?: Array<{ name: string; pct: number }>;
    entryWeightKg?: number;
    bodyConditionScore?: number;
    sireEarTag?: string;
    damEarTag?: string;
    rfidTag?: string;
    notes?: string;
  };
  derived: {
    suggestedCategory?: string;
    girolandoGrade?: string | null;
    resolvedBreeds?: Array<{ breedId: string; breedName: string; percentage: number }>;
  };
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface AnimalBulkPreviewResult {
  filename: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  columnHeaders: string[];
  rows: AnimalBulkPreviewRow[];
}

export interface AnimalBulkImportInput {
  columnMapping: AnimalColumnMapping;
  selectedIndices: number[];
}

export interface AnimalBulkImportResultItem {
  index: number;
  status: 'imported' | 'skipped';
  animalId?: string;
  earTag?: string;
  reason?: string;
}

export interface AnimalBulkImportResult {
  imported: number;
  skipped: number;
  items: AnimalBulkImportResultItem[];
  warnings: string[];
}

export const SEX_ALIASES: Record<string, string> = {
  m: 'MALE',
  macho: 'MALE',
  male: 'MALE',
  f: 'FEMALE',
  femea: 'FEMALE',
  fêmea: 'FEMALE',
  female: 'FEMALE',
};

export const ORIGIN_ALIASES: Record<string, string> = {
  nascido: 'BORN',
  born: 'BORN',
  comprado: 'PURCHASED',
  purchased: 'PURCHASED',
};

export const CATEGORY_ALIASES: Record<string, string> = {
  bezerro: 'BEZERRO',
  bezerra: 'BEZERRA',
  novilha: 'NOVILHA',
  novilho: 'NOVILHO',
  'vaca lactacao': 'VACA_LACTACAO',
  'vaca lactação': 'VACA_LACTACAO',
  vaca_lactacao: 'VACA_LACTACAO',
  'vaca seca': 'VACA_SECA',
  vaca_seca: 'VACA_SECA',
  'touro reprodutor': 'TOURO_REPRODUTOR',
  touro_reprodutor: 'TOURO_REPRODUTOR',
  touro: 'TOURO_REPRODUTOR',
  descarte: 'DESCARTE',
};

// Auto-mapping: header label → AnimalColumnMapping key
export const COLUMN_AUTO_MAP: Record<string, keyof AnimalColumnMapping> = {
  brinco: 'earTag',
  'ear tag': 'earTag',
  eartag: 'earTag',
  identificacao: 'earTag',
  identificação: 'earTag',
  nome: 'name',
  name: 'name',
  sexo: 'sex',
  sex: 'sex',
  nascimento: 'birthDate',
  'data nascimento': 'birthDate',
  birthdate: 'birthDate',
  'birth date': 'birthDate',
  categoria: 'category',
  category: 'category',
  origem: 'origin',
  origin: 'origin',
  raca: 'breed1',
  raça: 'breed1',
  raca1: 'breed1',
  breed: 'breed1',
  breed1: 'breed1',
  raca2: 'breed2',
  breed2: 'breed2',
  raca3: 'breed3',
  breed3: 'breed3',
  percentual: 'pct1',
  percentual1: 'pct1',
  pct1: 'pct1',
  '%': 'pct1',
  percentual2: 'pct2',
  pct2: 'pct2',
  percentual3: 'pct3',
  pct3: 'pct3',
  peso: 'entryWeightKg',
  'peso entrada': 'entryWeightKg',
  weight: 'entryWeightKg',
  ecc: 'bodyConditionScore',
  'condicao corporal': 'bodyConditionScore',
  bcs: 'bodyConditionScore',
  pai: 'sireEarTag',
  sire: 'sireEarTag',
  mae: 'damEarTag',
  mãe: 'damEarTag',
  dam: 'damEarTag',
  rfid: 'rfidTag',
  'rfid tag': 'rfidTag',
  notas: 'notes',
  notes: 'notes',
  obs: 'notes',
  observacao: 'notes',
  observação: 'notes',
};
