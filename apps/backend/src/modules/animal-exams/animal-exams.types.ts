// ─── Error ──────────────────────────────────────────────────────────

export class AnimalExamError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnimalExamError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const EXAM_CATEGORIES = ['MANDATORY', 'DIAGNOSTIC', 'ROUTINE'] as const;
export type ExamCategoryValue = (typeof EXAM_CATEGORIES)[number];

export const EXAM_CATEGORY_LABELS: Record<ExamCategoryValue, string> = {
  MANDATORY: 'Obrigatório/Regulatório',
  DIAGNOSTIC: 'Diagnóstico',
  ROUTINE: 'Rotina',
};

export const EXAM_METHODS = ['LABORATORY', 'FIELD', 'IMAGING'] as const;
export type ExamMethodValue = (typeof EXAM_METHODS)[number];

export const EXAM_METHOD_LABELS: Record<ExamMethodValue, string> = {
  LABORATORY: 'Laboratorial',
  FIELD: 'Campo',
  IMAGING: 'Imagem',
};

export const EXAM_MATERIALS = [
  'BLOOD',
  'FECES',
  'MILK',
  'URINE',
  'SKIN',
  'TISSUE',
  'OTHER',
] as const;
export type ExamMaterialValue = (typeof EXAM_MATERIALS)[number];

export const EXAM_MATERIAL_LABELS: Record<ExamMaterialValue, string> = {
  BLOOD: 'Sangue',
  FECES: 'Fezes',
  MILK: 'Leite',
  URINE: 'Urina',
  SKIN: 'Pele',
  TISSUE: 'Tecido',
  OTHER: 'Outro',
};

export const EXAM_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type ExamStatusValue = (typeof EXAM_STATUSES)[number];

export const EXAM_STATUS_LABELS: Record<ExamStatusValue, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const RESULT_INDICATORS = ['NORMAL', 'ABOVE', 'BELOW', 'POSITIVE', 'NEGATIVE'] as const;
export type ResultIndicatorValue = (typeof RESULT_INDICATORS)[number];

export const RESULT_INDICATOR_LABELS: Record<ResultIndicatorValue, string> = {
  NORMAL: 'Normal',
  ABOVE: 'Acima',
  BELOW: 'Abaixo',
  POSITIVE: 'Positivo',
  NEGATIVE: 'Negativo',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface ExamTypeParamInput {
  paramName: string;
  unit?: string | null;
  minReference?: number | null;
  maxReference?: number | null;
  isBooleanResult?: boolean;
  sortOrder?: number;
}

export interface CreateExamTypeInput {
  name: string;
  category: string;
  method: string;
  material?: string | null;
  defaultLab?: string | null;
  isRegulatory?: boolean;
  validityDays?: number | null;
  notes?: string | null;
  referenceParams?: ExamTypeParamInput[];
}

export interface UpdateExamTypeInput {
  name?: string;
  category?: string;
  method?: string;
  material?: string | null;
  defaultLab?: string | null;
  isRegulatory?: boolean;
  validityDays?: number | null;
  notes?: string | null;
  referenceParams?: ExamTypeParamInput[];
}

export interface ListExamTypesQuery {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateAnimalExamInput {
  animalId: string;
  examTypeId: string;
  collectionDate: string; // ISO date
  sendDate?: string | null;
  laboratory?: string | null;
  protocolNumber?: string | null;
  responsibleName: string;
  veterinaryName?: string | null;
  veterinaryCrmv?: string | null;
  certificateNumber?: string | null;
  certificateValidity?: string | null;
  notes?: string | null;
}

export interface BulkExamInput {
  animalLotId: string;
  examTypeId: string;
  collectionDate: string;
  sendDate?: string | null;
  laboratory?: string | null;
  protocolNumber?: string | null;
  responsibleName: string;
  veterinaryName?: string | null;
  veterinaryCrmv?: string | null;
  notes?: string | null;
}

export interface UpdateAnimalExamInput {
  sendDate?: string | null;
  laboratory?: string | null;
  protocolNumber?: string | null;
  responsibleName?: string;
  veterinaryName?: string | null;
  veterinaryCrmv?: string | null;
  certificateNumber?: string | null;
  certificateValidity?: string | null;
  notes?: string | null;
  status?: string;
}

export interface ResultInput {
  paramName: string;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  textValue?: string | null;
  unit?: string | null;
  minReference?: number | null;
  maxReference?: number | null;
}

export interface RecordResultsInput {
  resultDate: string;
  results: ResultInput[];
}

export interface ListAnimalExamsQuery {
  animalId?: string;
  examTypeId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface ExamTypeParamItem {
  id: string;
  paramName: string;
  unit: string | null;
  minReference: number | null;
  maxReference: number | null;
  isBooleanResult: boolean;
  sortOrder: number;
}

export interface ExamTypeItem {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  categoryLabel: string;
  method: string;
  methodLabel: string;
  material: string | null;
  materialLabel: string | null;
  defaultLab: string | null;
  isRegulatory: boolean;
  validityDays: number | null;
  notes: string | null;
  referenceParams: ExamTypeParamItem[];
  createdAt: string;
}

export interface ExamResultItem {
  id: string;
  paramName: string;
  numericValue: number | null;
  booleanValue: boolean | null;
  textValue: string | null;
  unit: string | null;
  minReference: number | null;
  maxReference: number | null;
  indicator: ResultIndicatorValue | null;
  indicatorLabel: string | null;
}

export interface AnimalExamItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  examTypeId: string;
  examTypeName: string;
  examTypeCategory: string;
  examTypeCategoryLabel: string;
  collectionDate: string;
  sendDate: string | null;
  laboratory: string | null;
  protocolNumber: string | null;
  status: ExamStatusValue;
  statusLabel: string;
  resultDate: string | null;
  responsibleName: string;
  veterinaryName: string | null;
  veterinaryCrmv: string | null;
  certificateNumber: string | null;
  certificateValidity: string | null;
  animalLotId: string | null;
  campaignId: string | null;
  linkedTreatmentId: string | null;
  reportFileName: string | null;
  reportMimeType: string | null;
  reportUrl: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  results: ExamResultItem[];
  createdAt: string;
}

export interface BulkExamResult {
  campaignId: string;
  created: number;
  animalCount: number;
}

export interface PositivityRate {
  examTypeName: string;
  total: number;
  positive: number;
  rate: number;
}

export interface ExamIndicators {
  pendingResults: number;
  expiredRegulatory: number;
  positivityRates: PositivityRate[];
}

export interface ImportExamResultsResult {
  imported: number;
  skipped: number;
  errors: string[];
}
