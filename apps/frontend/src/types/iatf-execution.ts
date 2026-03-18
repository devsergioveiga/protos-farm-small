export interface ReproductiveLotItem {
  id: string;
  farmId: string;
  name: string;
  protocolId: string;
  protocolName: string;
  d0Date: string;
  status: string;
  statusLabel: string;
  animalCount: number;
  stepsTotal: number;
  stepsDone: number;
  totalCostCents: number;
  notes: string | null;
  createdAt: string;
}

export interface LotAnimalItem {
  id: string;
  animalId: string;
  earTag: string;
  animalName: string | null;
  removedAt: string | null;
  removalReason: string | null;
}

export interface LotStepItem {
  id: string;
  dayNumber: number;
  scheduledDate: string;
  description: string;
  isAiDay: boolean;
  status: string;
  statusLabel: string;
  executedAt: string | null;
  responsibleName: string | null;
}

export interface InseminationItem {
  id: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  inseminationType: string;
  inseminationTypeLabel: string;
  bullId: string | null;
  bullName: string | null;
  semenBatchId: string | null;
  semenBatchNumber: string | null;
  dosesUsed: number;
  inseminatorName: string;
  inseminationDate: string;
  inseminationTime: string | null;
  cervicalMucus: string | null;
  cervicalMucusLabel: string | null;
  wasPlannedBull: boolean | null;
  substitutionReason: string | null;
  observations: string | null;
  createdAt: string;
}

export interface LotDetailItem extends ReproductiveLotItem {
  animals: LotAnimalItem[];
  steps: LotStepItem[];
  inseminations: InseminationItem[];
}

export interface ReproductiveLotsResponse {
  data: ReproductiveLotItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface UpcomingStepItem {
  lotId: string;
  lotName: string;
  stepId: string;
  dayNumber: number;
  scheduledDate: string;
  description: string;
  isAiDay: boolean;
}

export interface CreateLotInput {
  name: string;
  protocolId: string;
  d0Date: string;
  animalIds: string[];
  notes?: string | null;
}

export interface RecordInseminationInput {
  animalId: string;
  reproductiveLotId?: string | null;
  inseminationType: string;
  bullId?: string | null;
  semenBatchId?: string | null;
  dosesUsed: number;
  inseminatorName: string;
  inseminationDate: string;
  inseminationTime?: string | null;
  cervicalMucus?: string | null;
  observations?: string | null;
}

export const LOT_STATUSES = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'CANCELLED', label: 'Cancelado' },
] as const;

export const STEP_STATUSES = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'DONE', label: 'Realizado' },
  { value: 'SKIPPED', label: 'Pulado' },
] as const;

export const INSEMINATION_TYPES = [
  { value: 'IATF', label: 'IATF' },
  { value: 'NATURAL_HEAT', label: 'Cio natural' },
  { value: 'HEAT_DURING_PROTOCOL', label: 'Cio durante protocolo' },
] as const;

export const CERVICAL_MUCUS_OPTIONS = [
  { value: 'CRYSTALLINE', label: 'Cristalino/Transparente' },
  { value: 'CLOUDY', label: 'Turvo/Esbranquiçado' },
  { value: 'BLOODY', label: 'Sanguinolento' },
  { value: 'PURULENT', label: 'Purulento' },
  { value: 'ABSENT', label: 'Ausente' },
] as const;

export const LOT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Ativo', className: 'lot-status--active' },
  COMPLETED: { label: 'Concluído', className: 'lot-status--completed' },
  CANCELLED: { label: 'Cancelado', className: 'lot-status--cancelled' },
};

export const STEP_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendente', className: 'step-status--pending' },
  DONE: { label: 'Realizado', className: 'step-status--done' },
  SKIPPED: { label: 'Pulado', className: 'step-status--skipped' },
};
