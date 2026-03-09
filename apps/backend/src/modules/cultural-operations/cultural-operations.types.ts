// ─── Error ──────────────────────────────────────────────────────────

export class CulturalOperationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'CulturalOperationError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const CULTURAL_OPERATION_TYPES = [
  'CAPINA_MANUAL',
  'ROCAGEM_MECANICA',
  'IRRIGACAO',
  'PODA',
  'DESBROTA',
  'RALEIO',
  'QUEBRA_VENTO',
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

export const PRUNING_TYPES = ['ESQUELETAMENTO', 'DECOTE', 'RECEPA'] as const;

export const PRUNING_TYPE_LABELS: Record<string, string> = {
  ESQUELETAMENTO: 'Esqueletamento',
  DECOTE: 'Decote',
  RECEPA: 'Recepa',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateCulturalOperationInput {
  id?: string;
  fieldPlotId: string;
  performedAt: string;
  operationType: string;
  durationHours?: number | null;
  machineName?: string | null;
  laborCount?: number | null;
  laborHours?: number | null;
  irrigationDepthMm?: number | null;
  irrigationTimeMin?: number | null;
  irrigationSystem?: string | null;
  pruningType?: string | null;
  pruningPercentage?: number | null;
  machineHourCost?: number | null;
  laborHourCost?: number | null;
  supplyCost?: number | null;
  notes?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ─── Response Types ─────────────────────────────────────────────────

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
