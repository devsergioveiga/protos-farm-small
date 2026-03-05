import type { PaginationMeta } from './admin';

export type AnimalSex = 'MALE' | 'FEMALE';
export type AnimalCategory =
  | 'BEZERRO'
  | 'BEZERRA'
  | 'NOVILHA'
  | 'NOVILHO'
  | 'VACA_LACTACAO'
  | 'VACA_SECA'
  | 'TOURO_REPRODUTOR'
  | 'DESCARTE';
export type AnimalOrigin = 'BORN' | 'PURCHASED';
export type GenealogyClass =
  | 'PO'
  | 'PC_OC'
  | 'PC_OD'
  | 'GC_01'
  | 'GC_02'
  | 'GC_03'
  | 'PA'
  | 'LA'
  | 'CCG'
  | 'SRD';

export interface BreedItem {
  id: string;
  name: string;
  code: string | null;
  species: string;
  category: string;
  isDefault: boolean;
  organizationId: string | null;
}

export interface BreedComposition {
  id: string;
  breedId: string;
  percentage: number;
  fraction: string | null;
  breed: { id: string; name: string; code: string | null };
}

export interface AnimalParent {
  id: string;
  earTag: string;
  name: string | null;
}

export interface AnimalListItem {
  id: string;
  farmId: string;
  earTag: string;
  rfidTag: string | null;
  name: string | null;
  sex: AnimalSex;
  birthDate: string | null;
  birthDateEstimated: boolean;
  category: AnimalCategory;
  categorySuggested: AnimalCategory | null;
  origin: AnimalOrigin;
  entryWeightKg: number | null;
  bodyConditionScore: number | null;
  isCompositionEstimated: boolean;
  createdAt: string;
  compositions: BreedComposition[];
  breedSummary: string | null;
  sire: AnimalParent | null;
  dam: AnimalParent | null;
}

export interface GenealogicalRecord {
  id: string;
  genealogyClass: GenealogyClass;
  registrationNumber: string | null;
  associationName: string | null;
  registrationDate: string | null;
  girolando_grade: string | null;
  notes: string | null;
}

export interface AnimalDetail extends AnimalListItem {
  photoUrl: string | null;
  notes: string | null;
  genealogicalRecords: GenealogicalRecord[];
  offspring: Array<{
    id: string;
    earTag: string;
    name: string | null;
    sex: AnimalSex;
  }>;
}

export interface AnimalsResponse {
  data: AnimalListItem[];
  meta: PaginationMeta;
}

export interface AnimalsSummary {
  total: number;
  byCategory: Record<string, number>;
  bySex: Record<string, number>;
}

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

export interface CreateAnimalPayload {
  earTag: string;
  rfidTag?: string;
  name?: string;
  sex: AnimalSex;
  birthDate?: string;
  birthDateEstimated?: boolean;
  category?: AnimalCategory;
  origin?: AnimalOrigin;
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

// Labels
export const SEX_LABELS: Record<AnimalSex, string> = {
  MALE: 'Macho',
  FEMALE: 'Fêmea',
};

export const CATEGORY_LABELS: Record<AnimalCategory, string> = {
  BEZERRO: 'Bezerro',
  BEZERRA: 'Bezerra',
  NOVILHA: 'Novilha',
  NOVILHO: 'Novilho',
  VACA_LACTACAO: 'Vaca em Lactação',
  VACA_SECA: 'Vaca Seca',
  TOURO_REPRODUTOR: 'Touro Reprodutor',
  DESCARTE: 'Descarte',
};

export const ORIGIN_LABELS: Record<AnimalOrigin, string> = {
  BORN: 'Nascido',
  PURCHASED: 'Comprado',
};

export const GENEALOGY_CLASS_LABELS: Record<GenealogyClass, string> = {
  PO: 'Puro de Origem',
  PC_OC: 'PC de Origem Conhecida',
  PC_OD: 'PC de Origem Desconhecida',
  GC_01: 'Grau de Cruzamento 1',
  GC_02: 'Grau de Cruzamento 2',
  GC_03: 'Grau de Cruzamento 3',
  PA: 'Puro por Absorção',
  LA: 'Livro Aberto',
  CCG: 'Controle de Cruzamento Girolando',
  SRD: 'Sem Raça Definida',
};

// ─── Bulk Import Types ────────────────────────────────────────────────

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
