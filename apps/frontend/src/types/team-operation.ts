export interface TeamOperationEntryItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  hoursWorked: number | null;
  productivity: number | null;
  productivityUnit: string | null;
  notes: string | null;
  hourlyRate: number | null;
  laborCost: number | null;
}

export interface TeamOperationItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  teamId: string;
  teamName: string;
  operationType: string;
  operationTypeLabel: string;
  performedAt: string;
  timeStart: string;
  timeEnd: string;
  durationHours: number;
  notes: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  entryCount: number;
  entries: TeamOperationEntryItem[];
  totalLaborCost: number | null;
  totalProductivity: number | null;
  productivityUnit: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamOperationsResponse {
  data: TeamOperationItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TeamOperationEntryInput {
  userId: string;
  hoursWorked?: number | null;
  productivity?: number | null;
  productivityUnit?: string | null;
  notes?: string | null;
}

export interface CreateTeamOperationInput {
  fieldPlotId: string;
  teamId: string;
  operationType: string;
  performedAt: string;
  timeStart: string;
  timeEnd: string;
  memberIds: string[];
  entries?: TeamOperationEntryInput[];
  notes?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ProductivityTargetItem {
  id: string;
  farmId: string;
  operationType: string;
  operationTypeLabel: string;
  targetValue: number;
  targetUnit: string;
  period: string;
  ratePerUnit: number | null;
  rateUnit: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductivityTargetInput {
  operationType: string;
  targetValue: number;
  targetUnit: string;
  period?: string;
  ratePerUnit?: number | null;
  rateUnit?: string | null;
}

export const PRODUCTIVITY_UNITS = [
  { value: 'kg', label: 'Quilogramas (kg)' },
  { value: 'litros', label: 'Litros' },
  { value: 'caixas', label: 'Caixas' },
  { value: 'ha', label: 'Hectares (ha)' },
  { value: 'animais', label: 'Animais' },
] as const;

export const TEAM_OPERATION_TYPES = [
  { value: 'PULVERIZACAO', label: 'Pulverização' },
  { value: 'ADUBACAO', label: 'Adubação' },
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'COLHEITA', label: 'Colheita' },
  { value: 'IRRIGACAO', label: 'Irrigação' },
  { value: 'MANEJO_PASTO', label: 'Manejo de pasto' },
  { value: 'VACINACAO', label: 'Vacinação' },
  { value: 'VERMIFUGACAO', label: 'Vermifugação' },
  { value: 'INSEMINACAO', label: 'Inseminação' },
  { value: 'MOVIMENTACAO', label: 'Movimentação' },
  { value: 'PESAGEM', label: 'Pesagem' },
  { value: 'OUTRO', label: 'Outro' },
] as const;
