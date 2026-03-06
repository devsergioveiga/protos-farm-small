// ─── Error ──────────────────────────────────────────────────────────

export class AnimalLotError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnimalLotError';
  }
}

// ─── Constants ──────────────────────────────────────────────────────

export const LOT_LOCATION_TYPES = [
  'PASTO',
  'GALPAO',
  'BEZERREIRO',
  'CURRAL',
  'BAIA',
  'CONFINAMENTO',
  'OUTRO',
] as const;
export type LotLocationTypeValue = (typeof LOT_LOCATION_TYPES)[number];

export const LOT_LOCATION_TYPE_LABELS: Record<LotLocationTypeValue, string> = {
  PASTO: 'Pasto',
  GALPAO: 'Galpão',
  BEZERREIRO: 'Bezerreiro',
  CURRAL: 'Curral',
  BAIA: 'Baia',
  CONFINAMENTO: 'Confinamento',
  OUTRO: 'Outro',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateLotInput {
  name: string;
  predominantCategory: string;
  currentLocation: string;
  locationType: string;
  maxCapacity?: number | null;
  description?: string | null;
  notes?: string | null;
}

export interface UpdateLotInput {
  name?: string;
  predominantCategory?: string;
  currentLocation?: string;
  locationType?: string;
  maxCapacity?: number | null;
  description?: string | null;
  notes?: string | null;
}

export interface MoveAnimalsInput {
  animalIds: string[];
  reason?: string;
}

export interface RemoveAnimalsFromLotInput {
  animalIds: string[];
  reason?: string;
}

export interface ListLotsQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  locationType?: string;
}

// ─── Dashboard / History Types ──────────────────────────────────────

export interface LotDashboard {
  animalCount: number;
  maxCapacity: number | null;
  capacityPercent: number | null;
  isOverCapacity: boolean;
  avgWeightKg: number | null;
  avgProductionLDay: number | null;
  avgDaysInLot: number | null;
}

export interface LotCompositionHistoryEntry {
  date: string;
  animalCount: number;
  categories: Record<string, number>;
}
