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
  indicator: string | null;
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
  status: string;
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
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  results: ExamResultItem[];
  createdAt: string;
}

export interface AnimalExamsResponse {
  data: AnimalExamItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ExamTypesResponse {
  data: ExamTypeItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ExamIndicators {
  pendingResults: number;
  expiredRegulatory: number;
  positivityRates: Array<{
    examTypeName: string;
    total: number;
    positive: number;
    rate: number;
  }>;
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
  referenceParams?: Array<{
    paramName: string;
    unit?: string | null;
    minReference?: number | null;
    maxReference?: number | null;
    isBooleanResult?: boolean;
    sortOrder?: number;
  }>;
}

export interface CreateAnimalExamInput {
  animalId: string;
  examTypeId: string;
  collectionDate: string;
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

export interface RecordResultsInput {
  resultDate: string;
  results: Array<{
    paramName: string;
    numericValue?: number | null;
    booleanValue?: boolean | null;
    textValue?: string | null;
    unit?: string | null;
    minReference?: number | null;
    maxReference?: number | null;
  }>;
}

export const EXAM_CATEGORIES = [
  { value: 'MANDATORY', label: 'Obrigatório/Regulatório' },
  { value: 'DIAGNOSTIC', label: 'Diagnóstico' },
  { value: 'ROUTINE', label: 'Rotina' },
] as const;

export const EXAM_METHODS = [
  { value: 'LABORATORY', label: 'Laboratorial' },
  { value: 'FIELD', label: 'Campo' },
  { value: 'IMAGING', label: 'Imagem' },
] as const;

export const EXAM_MATERIALS = [
  { value: 'BLOOD', label: 'Sangue' },
  { value: 'FECES', label: 'Fezes' },
  { value: 'MILK', label: 'Leite' },
  { value: 'URINE', label: 'Urina' },
  { value: 'SKIN', label: 'Pele' },
  { value: 'TISSUE', label: 'Tecido' },
  { value: 'OTHER', label: 'Outro' },
] as const;

export const EXAM_STATUSES = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'CANCELLED', label: 'Cancelado' },
] as const;
