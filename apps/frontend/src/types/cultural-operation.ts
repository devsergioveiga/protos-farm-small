export interface CulturalOperationItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  performedAt: string;
  operationType: string;
  operationTypeLabel: string;
  durationHours: number | null;
  machineName: string | null;
  laborCount: number | null;
  laborHours: number | null;
  irrigationDepthMm: number | null;
  irrigationTimeMin: number | null;
  irrigationSystem: string | null;
  pruningType: string | null;
  pruningTypeLabel: string | null;
  pruningPercentage: number | null;
  machineHourCost: number | null;
  laborHourCost: number | null;
  supplyCost: number | null;
  totalCost: number | null;
  notes: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CulturalOperationsResponse {
  data: CulturalOperationItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCulturalOperationInput {
  fieldPlotId: string;
  performedAt: string;
  operationType: string;
  durationHours?: number;
  machineName?: string;
  laborCount?: number;
  laborHours?: number;
  irrigationDepthMm?: number;
  irrigationTimeMin?: number;
  irrigationSystem?: string;
  pruningType?: string;
  pruningPercentage?: number;
  machineHourCost?: number;
  laborHourCost?: number;
  supplyCost?: number;
  notes?: string;
}

export const CULTURAL_OPERATION_TYPES = [
  { value: 'CAPINA_MANUAL', label: 'Capina manual' },
  { value: 'ROCAGEM_MECANICA', label: 'Roçagem mecânica' },
  { value: 'IRRIGACAO', label: 'Irrigação' },
  { value: 'PODA', label: 'Poda' },
  { value: 'DESBROTA', label: 'Desbrota' },
  { value: 'RALEIO', label: 'Raleio' },
  { value: 'QUEBRA_VENTO', label: 'Quebra-vento' },
] as const;

export const PRUNING_TYPES = [
  { value: 'ESQUELETAMENTO', label: 'Esqueletamento' },
  { value: 'DECOTE', label: 'Decote' },
  { value: 'RECEPA', label: 'Recepa' },
] as const;

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  CAPINA_MANUAL: 'Capina manual',
  ROCAGEM_MECANICA: 'Roçagem mecânica',
  IRRIGACAO: 'Irrigação',
  PODA: 'Poda',
  DESBROTA: 'Desbrota',
  RALEIO: 'Raleio',
  QUEBRA_VENTO: 'Quebra-vento',
};
