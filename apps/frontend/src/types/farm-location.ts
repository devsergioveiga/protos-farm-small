export type FarmLocationType = 'PASTURE' | 'FACILITY';
export type PastureStatus = 'EM_USO' | 'DESCANSO' | 'REFORMANDO';
export type FacilityStatus = 'ATIVO' | 'MANUTENCAO' | 'INATIVO';
export type ForageType =
  | 'BRACHIARIA_BRIZANTHA'
  | 'BRACHIARIA_DECUMBENS'
  | 'BRACHIARIA_HUMIDICOLA'
  | 'PANICUM_MAXIMUM'
  | 'PANICUM_MOMBASA'
  | 'PANICUM_TANZANIA'
  | 'CYNODON_TIFTON'
  | 'CYNODON_COASTCROSS'
  | 'PENNISETUM_NAPIER'
  | 'ANDROPOGON'
  | 'ESTILOSANTES'
  | 'OUTRO';
export type FacilityType =
  | 'GALPAO'
  | 'BEZERREIRO'
  | 'CURRAL'
  | 'BAIA'
  | 'SALA_ORDENHA'
  | 'ESTABULO'
  | 'CONFINAMENTO'
  | 'OUTRO';
export type OccupancyLevel = 'green' | 'yellow' | 'red';

export const PASTURE_STATUS_LABELS: Record<PastureStatus, string> = {
  EM_USO: 'Em uso',
  DESCANSO: 'Descanso',
  REFORMANDO: 'Reformando',
};

export const FACILITY_STATUS_LABELS: Record<FacilityStatus, string> = {
  ATIVO: 'Ativo',
  MANUTENCAO: 'Manutenção',
  INATIVO: 'Inativo',
};

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  GALPAO: 'Galpão',
  BEZERREIRO: 'Bezerreiro',
  CURRAL: 'Curral',
  BAIA: 'Baia',
  SALA_ORDENHA: 'Sala de Ordenha',
  ESTABULO: 'Estábulo',
  CONFINAMENTO: 'Confinamento',
  OUTRO: 'Outro',
};

export const FORAGE_TYPE_LABELS: Record<ForageType, string> = {
  BRACHIARIA_BRIZANTHA: 'Brachiaria Brizantha',
  BRACHIARIA_DECUMBENS: 'Brachiaria Decumbens',
  BRACHIARIA_HUMIDICOLA: 'Brachiaria Humidicola',
  PANICUM_MAXIMUM: 'Panicum Maximum',
  PANICUM_MOMBASA: 'Panicum Mombaça',
  PANICUM_TANZANIA: 'Panicum Tanzânia',
  CYNODON_TIFTON: 'Cynodon Tifton',
  CYNODON_COASTCROSS: 'Cynodon Coastcross',
  PENNISETUM_NAPIER: 'Pennisetum Napier',
  ANDROPOGON: 'Andropogon',
  ESTILOSANTES: 'Estilosantes',
  OUTRO: 'Outro',
};

export interface LocationOccupancy {
  totalAnimals: number;
  capacityUA: number | null;
  capacityAnimals: number | null;
  occupancyPercent: number | null;
  level: OccupancyLevel;
}

export interface FarmLocation {
  id: string;
  farmId: string;
  name: string;
  type: FarmLocationType;
  boundaryAreaHa: number | null;
  capacityUA: number | null;
  capacityAnimals: number | null;
  forageType: ForageType | null;
  pastureStatus: PastureStatus | null;
  facilityType: FacilityType | null;
  facilityStatus: FacilityStatus | null;
  description: string | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { lots: number; animals?: number };
}

export interface FarmLocationMapItem {
  id: string;
  name: string;
  type: FarmLocationType;
  boundaryGeoJSON: GeoJSON.Geometry | null;
  boundaryAreaHa: number | null;
  capacityUA: number | null;
  capacityAnimals: number | null;
  forageType: ForageType | null;
  pastureStatus: PastureStatus | null;
  facilityType: FacilityType | null;
  facilityStatus: FacilityStatus | null;
  description: string | null;
  occupancy: LocationOccupancy;
}
