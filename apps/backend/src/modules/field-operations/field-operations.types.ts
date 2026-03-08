// ─── Error ──────────────────────────────────────────────────────────

export class FieldOperationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FieldOperationError';
  }
}

// ─── Input Types ────────────────────────────────────────────────────

export const FIELD_OPERATION_TYPES = [
  'PULVERIZACAO',
  'ADUBACAO',
  'PLANTIO',
  'COLHEITA',
  'IRRIGACAO',
  'MANEJO_PASTO',
  'VACINACAO',
  'VERMIFUGACAO',
  'INSEMINACAO',
  'MOVIMENTACAO',
  'PESAGEM',
  'OUTRO',
] as const;

export const LOCATION_TYPES = ['PLOT', 'PASTURE', 'FACILITY'] as const;

export interface CreateFieldOperationInput {
  id?: string;
  locationId?: string | null;
  locationType?: string | null;
  locationName?: string | null;
  operationType: string;
  notes?: string | null;
  photoUri?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  recordedAt: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface FieldOperationItem {
  id: string;
  farmId: string;
  locationId: string | null;
  locationType: string | null;
  locationName: string | null;
  operationType: string;
  notes: string | null;
  photoUri: string | null;
  latitude: number | null;
  longitude: number | null;
  recordedAt: string;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}
