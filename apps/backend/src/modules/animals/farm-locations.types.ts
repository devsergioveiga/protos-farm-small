// ─── Farm Locations Types ────────────────────────────────────────────

export class FarmLocationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FarmLocationError';
  }
}

// ─── Enum Constants ─────────────────────────────────────────────────

export const FARM_LOCATION_TYPES = ['PASTURE', 'FACILITY'] as const;
export type FarmLocationTypeValue = (typeof FARM_LOCATION_TYPES)[number];

export const PASTURE_STATUSES = ['EM_USO', 'DESCANSO', 'REFORMANDO'] as const;
export type PastureStatusValue = (typeof PASTURE_STATUSES)[number];

export const FACILITY_STATUSES = ['ATIVO', 'MANUTENCAO', 'INATIVO'] as const;
export type FacilityStatusValue = (typeof FACILITY_STATUSES)[number];

export const FORAGE_TYPES = [
  'BRACHIARIA_BRIZANTHA',
  'BRACHIARIA_DECUMBENS',
  'BRACHIARIA_HUMIDICOLA',
  'PANICUM_MAXIMUM',
  'PANICUM_MOMBASA',
  'PANICUM_TANZANIA',
  'CYNODON_TIFTON',
  'CYNODON_COASTCROSS',
  'PENNISETUM_NAPIER',
  'ANDROPOGON',
  'ESTILOSANTES',
  'OUTRO',
] as const;
export type ForageTypeValue = (typeof FORAGE_TYPES)[number];

export const FACILITY_TYPES = [
  'GALPAO',
  'BEZERREIRO',
  'CURRAL',
  'BAIA',
  'SALA_ORDENHA',
  'ESTABULO',
  'CONFINAMENTO',
  'OUTRO',
] as const;
export type FacilityTypeValue = (typeof FACILITY_TYPES)[number];

// ─── Inputs ─────────────────────────────────────────────────────────

export interface CreateLocationInput {
  name: string;
  type: FarmLocationTypeValue;
  capacityUA?: number;
  capacityAnimals?: number;
  forageType?: ForageTypeValue;
  pastureStatus?: PastureStatusValue;
  facilityType?: FacilityTypeValue;
  facilityStatus?: FacilityStatusValue;
  description?: string;
  notes?: string;
}

export interface UpdateLocationInput {
  name?: string;
  capacityUA?: number;
  capacityAnimals?: number;
  forageType?: ForageTypeValue;
  pastureStatus?: PastureStatusValue;
  facilityType?: FacilityTypeValue;
  facilityStatus?: FacilityStatusValue;
  description?: string;
  notes?: string;
}

export interface ListLocationsQuery {
  page?: number;
  limit?: number;
  type?: FarmLocationTypeValue;
  search?: string;
  pastureStatus?: PastureStatusValue;
  facilityStatus?: FacilityStatusValue;
}

// ─── Outputs ────────────────────────────────────────────────────────

export type OccupancyLevel = 'green' | 'yellow' | 'red';

export interface LocationOccupancy {
  totalAnimals: number;
  capacityUA: number | null;
  capacityAnimals: number | null;
  occupancyPercent: number | null;
  level: OccupancyLevel;
}
