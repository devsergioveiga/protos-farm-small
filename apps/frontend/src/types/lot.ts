import type { PaginationMeta } from './admin';
import type { AnimalCategory } from './animal';

export type LotLocationType =
  | 'PASTO'
  | 'GALPAO'
  | 'BEZERREIRO'
  | 'CURRAL'
  | 'BAIA'
  | 'CONFINAMENTO'
  | 'OUTRO';

export const LOCATION_TYPE_LABELS: Record<LotLocationType, string> = {
  PASTO: 'Pasto',
  GALPAO: 'Galpão',
  BEZERREIRO: 'Bezerreiro',
  CURRAL: 'Curral',
  BAIA: 'Baia',
  CONFINAMENTO: 'Confinamento',
  OUTRO: 'Outro',
};

export const LOCATION_TYPES: LotLocationType[] = [
  'PASTO',
  'GALPAO',
  'BEZERREIRO',
  'CURRAL',
  'BAIA',
  'CONFINAMENTO',
  'OUTRO',
];

export interface LotListItem {
  id: string;
  farmId: string;
  name: string;
  predominantCategory: AnimalCategory;
  currentLocation: string;
  locationType: LotLocationType;
  maxCapacity: number | null;
  description: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { animals: number };
}

export interface LotsResponse {
  data: LotListItem[];
  meta: PaginationMeta;
}

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

export interface CapacityAlert {
  id: string;
  name: string;
  currentCount: number;
  maxCapacity: number;
  overBy: number;
}

export interface CreateLotPayload {
  name: string;
  predominantCategory: AnimalCategory;
  currentLocation: string;
  locationType: LotLocationType;
  maxCapacity?: number | null;
  description?: string | null;
  notes?: string | null;
}

export interface UpdateLotPayload {
  name?: string;
  predominantCategory?: AnimalCategory;
  currentLocation?: string;
  locationType?: LotLocationType;
  maxCapacity?: number | null;
  description?: string | null;
  notes?: string | null;
}

export interface MoveAnimalsPayload {
  animalIds: string[];
  reason?: string;
}
