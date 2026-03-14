export interface ApplicationItem {
  id: string;
  treatmentId: string;
  productId: string | null;
  productName: string;
  dosage: number;
  dosageUnit: string;
  dosageUnitLabel: string;
  administrationRoute: string;
  administrationRouteLabel: string;
  scheduledDate: string;
  scheduledTime: string | null;
  applicationDate: string | null;
  applicationTime: string | null;
  status: 'PENDING' | 'DONE' | 'NOT_DONE';
  statusLabel: string;
  notDoneReason: string | null;
  responsibleName: string | null;
  stockOutputId: string | null;
  costCents: number;
  notes: string | null;
}

export interface EvolutionItem {
  id: string;
  treatmentId: string;
  evolutionDate: string;
  evolutionType: 'IMPROVEMENT' | 'STABLE' | 'WORSENING';
  evolutionTypeLabel: string;
  temperature: number | null;
  observations: string | null;
  veterinaryName: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface TreatmentItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  diseaseId: string | null;
  diseaseName: string;
  diagnosisDate: string;
  observedSeverity: string;
  severityLabel: string;
  clinicalObservations: string | null;
  veterinaryName: string;
  responsibleName: string;
  treatmentProtocolId: string | null;
  treatmentProtocolName: string | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  withdrawalEndDate: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  statusLabel: string;
  outcome: string | null;
  outcomeLabel: string | null;
  closedAt: string | null;
  closingNotes: string | null;
  totalCostCents: number;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  applications: ApplicationItem[];
  evolutions: EvolutionItem[];
  pendingApplicationsToday: number;
  createdAt: string;
}

export interface TreatmentListItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  diseaseName: string;
  diagnosisDate: string;
  observedSeverity: string;
  severityLabel: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  statusLabel: string;
  outcome: string | null;
  outcomeLabel: string | null;
  veterinaryName: string;
  treatmentProtocolName: string | null;
  totalCostCents: number;
  createdAt: string;
}

export interface TreatmentsResponse {
  data: TreatmentListItem[];
  total: number;
}

export interface AdhocProductInput {
  productId?: string | null;
  productName: string;
  dosage: number;
  dosageUnit: string;
  administrationRoute: string;
  durationDays: number;
  frequencyPerDay?: number;
  startDay?: number;
}

export interface CreateTreatmentInput {
  animalId: string;
  diseaseId?: string | null;
  diseaseName: string;
  diagnosisDate: string;
  observedSeverity: string;
  clinicalObservations?: string | null;
  veterinaryName: string;
  responsibleName: string;
  treatmentProtocolId?: string | null;
  notes?: string | null;
  adhocProducts?: AdhocProductInput[];
}

export interface CloseTreatmentInput {
  outcome: string;
  closingNotes?: string | null;
}

export const SEVERITY_OPTIONS = [
  { value: 'MILD', label: 'Leve' },
  { value: 'MODERATE', label: 'Moderada' },
  { value: 'SEVERE', label: 'Grave' },
] as const;

export const OUTCOME_OPTIONS = [
  { value: 'CURED', label: 'Curado' },
  { value: 'PARTIAL_IMPROVEMENT', label: 'Melhora parcial' },
  { value: 'DEATH', label: 'Óbito' },
  { value: 'CHRONIC', label: 'Crônico' },
  { value: 'REFERRED_DISPOSAL', label: 'Encaminhado para descarte' },
] as const;

export const EVOLUTION_TYPE_OPTIONS = [
  { value: 'IMPROVEMENT', label: 'Melhora' },
  { value: 'STABLE', label: 'Estável' },
  { value: 'WORSENING', label: 'Piora' },
] as const;

export const STATUS_CONFIG = {
  OPEN: { label: 'Aberto', className: 'status--open' },
  IN_PROGRESS: { label: 'Em andamento', className: 'status--in-progress' },
  CLOSED: { label: 'Encerrado', className: 'status--closed' },
} as const;

export const APPLICATION_STATUS_CONFIG = {
  PENDING: { label: 'Pendente', className: 'app-status--pending' },
  DONE: { label: 'Realizado', className: 'app-status--done' },
  NOT_DONE: { label: 'Não realizado', className: 'app-status--not-done' },
} as const;

export const ADMINISTRATION_ROUTES = [
  { value: 'IM', label: 'Intramuscular' },
  { value: 'SC', label: 'Subcutâneo' },
  { value: 'IV', label: 'Intravenoso' },
  { value: 'ORAL', label: 'Oral' },
  { value: 'INTRAMMARY', label: 'Intramamário' },
  { value: 'TOPICAL', label: 'Tópico' },
] as const;

export const DOSAGE_UNITS = [
  { value: 'MG_KG', label: 'mg/kg' },
  { value: 'ML_ANIMAL', label: 'mL/animal' },
  { value: 'FIXED_DOSE', label: 'Dose fixa' },
] as const;
