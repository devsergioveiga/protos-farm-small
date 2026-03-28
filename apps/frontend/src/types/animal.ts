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
  registeredName: string | null;
  registrationNumber: string | null;
  sex: AnimalSex;
  birthDate: string | null;
  birthDateEstimated: boolean;
  category: AnimalCategory;
  categorySuggested: AnimalCategory | null;
  origin: AnimalOrigin;
  entryWeightKg: number | null;
  bodyConditionScore: number | null;
  lotId: string | null;
  lotName: string | null;
  isCompositionEstimated: boolean;
  createdAt: string;
  compositions: BreedComposition[];
  breedSummary: string | null;
  sire: AnimalParent | null;
  dam: AnimalParent | null;
  currentOwners: AnimalOwnerSummary[];
  ownerSummary: string | null;
}

export interface AnimalOwnerSummary {
  producerId: string;
  producerName: string;
  ownershipType: string;
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

export interface GroupStats {
  totalCount: number;
  averageWeightKg: number | null;
}

export interface AnimalsResponse {
  data: AnimalListItem[];
  meta: PaginationMeta;
  groupStats: GroupStats;
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
  registeredName?: string;
  registrationNumber?: string;
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

export type UpdateAnimalPayload = Partial<CreateAnimalPayload>;

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

// ─── Weighing Types ──────────────────────────────────────────────────

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

export interface WeighingStats {
  currentWeightKg: number | null;
  entryWeightKg: number | null;
  totalGainKg: number | null;
  gmdKgDay: number | null;
  minWeightKg: number | null;
  maxWeightKg: number | null;
  totalWeighings: number;
}

// ─── Health Record Types ──────────────────────────────────────────────

export type HealthEventType = 'VACCINATION' | 'DEWORMING' | 'TREATMENT' | 'EXAM';
export type ApplicationMethod = 'INJECTABLE' | 'ORAL' | 'POUR_ON' | 'OTHER';

export interface HealthRecordItem {
  id: string;
  animalId: string;
  farmId: string;
  type: HealthEventType;
  eventDate: string;
  productName: string | null;
  dosage: string | null;
  applicationMethod: ApplicationMethod | null;
  batchNumber: string | null;
  diagnosis: string | null;
  durationDays: number | null;
  examResult: string | null;
  labName: string | null;
  isFieldExam: boolean | null;
  veterinaryName: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface HealthStats {
  totalRecords: number;
  vaccinations: number;
  dewormings: number;
  treatments: number;
  exams: number;
  lastVaccinationDate: string | null;
  lastDewormingDate: string | null;
  lastTreatmentDate: string | null;
  lastExamDate: string | null;
}

export const HEALTH_EVENT_TYPE_LABELS: Record<HealthEventType, string> = {
  VACCINATION: 'Vacinação',
  DEWORMING: 'Vermifugação',
  TREATMENT: 'Tratamento',
  EXAM: 'Exame',
};

export const APPLICATION_METHOD_LABELS: Record<ApplicationMethod, string> = {
  INJECTABLE: 'Injetável',
  ORAL: 'Oral',
  POUR_ON: 'Pour-on',
  OTHER: 'Outro',
};

// ─── Reproductive Record Types ──────────────────────────────────────

export type ReproductiveEventType =
  | 'CLEARANCE'
  | 'HEAT'
  | 'BREEDING_PLAN'
  | 'AI'
  | 'PREGNANCY'
  | 'CALVING';

export type HeatIntensity = 'WEAK' | 'MODERATE' | 'STRONG';
export type BreedingMethod = 'NATURAL' | 'AI' | 'ET';
export type CalvingType = 'NORMAL' | 'ASSISTED' | 'CESAREAN' | 'DYSTOCIC';
export type PregnancyConfirmation = 'PALPATION' | 'ULTRASOUND' | 'BLOOD_TEST' | 'OBSERVATION';

export interface ReproductiveRecordItem {
  id: string;
  animalId: string;
  farmId: string;
  type: ReproductiveEventType;
  eventDate: string;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  approvedBy: string | null;
  criteriaDetails: string | null;
  heatIntensity: HeatIntensity | null;
  intervalDays: number | null;
  plannedSireId: string | null;
  plannedSireName: string | null;
  breedingMethod: BreedingMethod | null;
  plannedDate: string | null;
  sireId: string | null;
  sireName: string | null;
  semenBatch: string | null;
  technicianName: string | null;
  confirmationMethod: PregnancyConfirmation | null;
  confirmationDate: string | null;
  expectedDueDate: string | null;
  calvingType: CalvingType | null;
  calvingComplications: string | null;
  calfId: string | null;
  calfEarTag: string | null;
  calfSex: string | null;
  calfWeightKg: number | null;
  createdAt: string;
}

export interface ReproductiveStats {
  totalRecords: number;
  clearances: number;
  heats: number;
  breedingPlans: number;
  ais: number;
  pregnancies: number;
  calvings: number;
  lastHeatDate: string | null;
  lastAiDate: string | null;
  lastCalvingDate: string | null;
  isPregnant: boolean;
  averageHeatIntervalDays: number | null;
}

export const REPRODUCTIVE_EVENT_TYPE_LABELS: Record<ReproductiveEventType, string> = {
  CLEARANCE: 'Liberação',
  HEAT: 'Cio',
  BREEDING_PLAN: 'Plano Acasalamento',
  AI: 'Inseminação',
  PREGNANCY: 'Gestação',
  CALVING: 'Parto',
};

export const HEAT_INTENSITY_LABELS: Record<HeatIntensity, string> = {
  WEAK: 'Fraco',
  MODERATE: 'Moderado',
  STRONG: 'Forte',
};

export const BREEDING_METHOD_LABELS: Record<BreedingMethod, string> = {
  NATURAL: 'Monta Natural',
  AI: 'Inseminação Artificial',
  ET: 'Transferência de Embrião',
};

export const CALVING_TYPE_LABELS: Record<CalvingType, string> = {
  NORMAL: 'Normal',
  ASSISTED: 'Assistido',
  CESAREAN: 'Cesariana',
  DYSTOCIC: 'Distócico',
};

export const PREGNANCY_CONFIRMATION_LABELS: Record<PregnancyConfirmation, string> = {
  PALPATION: 'Palpação',
  ULTRASOUND: 'Ultrassom',
  BLOOD_TEST: 'Exame de Sangue',
  OBSERVATION: 'Observação',
};

// ─── Movement Types ────────────────────────────────────────────────────

export interface AnimalMovementItem {
  id: string;
  lotName: string;
  lotLocationType: string;
  locationName: string | null;
  previousLotName: string | null;
  enteredAt: string;
  exitedAt: string | null;
  durationDays: number;
  reason: string | null;
  movedByName: string;
}

export interface AnimalMovementStats {
  totalMovements: number;
  currentLotName: string | null;
  currentLocationName: string | null;
  daysInCurrentLot: number | null;
  distinctLots: number;
}

export const LOT_LOCATION_TYPE_LABELS: Record<string, string> = {
  PASTO: 'Pasto',
  CONFINAMENTO: 'Confinamento',
  GALPAO: 'Galpão',
  BEZERREIRO: 'Bezerreiro',
  OUTRO: 'Outro',
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
