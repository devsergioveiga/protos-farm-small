export interface StepItem {
  id: string;
  order: number;
  productId: string | null;
  productName: string;
  dosage: number;
  dosageUnit: string;
  dosageUnitLabel: string;
  administrationRoute: string;
  administrationRouteLabel: string;
  frequencyPerDay: number;
  startDay: number;
  durationDays: number;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  notes: string | null;
}

export interface ProtocolDiseaseItem {
  id: string;
  diseaseId: string;
  diseaseName: string;
}

export interface ProtocolItem {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  notes: string | null;
  severity: string | null;
  severityLabel: string | null;
  authorName: string;
  status: string;
  statusLabel: string;
  version: number;
  originalId: string | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  estimatedCostCents: number | null;
  diseases: ProtocolDiseaseItem[];
  steps: StepItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProtocolsResponse {
  data: ProtocolItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface StepInput {
  order: number;
  productId?: string | null;
  productName: string;
  dosage: number;
  dosageUnit: string;
  administrationRoute: string;
  frequencyPerDay?: number;
  startDay?: number;
  durationDays: number;
  withdrawalMeatDays?: number | null;
  withdrawalMilkDays?: number | null;
  notes?: string | null;
}

export interface CreateProtocolInput {
  name: string;
  description?: string | null;
  notes?: string | null;
  severity?: string | null;
  authorName: string;
  status?: string;
  diseaseIds?: string[];
  steps: StepInput[];
}

export const ADMINISTRATION_ROUTES = [
  { value: 'IM', label: 'Intramuscular' },
  { value: 'SC', label: 'Subcutâneo' },
  { value: 'IV', label: 'Intravenoso' },
  { value: 'ORAL', label: 'Oral' },
  { value: 'INTRAMMARY', label: 'Intramamária' },
  { value: 'TOPICAL', label: 'Tópica' },
] as const;

export const DOSAGE_UNITS = [
  { value: 'MG_KG', label: 'mg/kg' },
  { value: 'ML_ANIMAL', label: 'mL/animal' },
  { value: 'FIXED_DOSE', label: 'Dose fixa' },
] as const;

export const PROTOCOL_STATUSES = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'INACTIVE', label: 'Inativo' },
] as const;
