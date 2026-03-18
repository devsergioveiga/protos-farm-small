export interface CoffeeHarvestItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  fieldPlotAreaHa: number;
  cultivarId: string | null;
  cultivarName: string | null;
  harvestDate: string;
  harvestType: string;
  harvestTypeLabel: string;
  volumeLiters: number;
  sacsBenefited: number | null;
  estimatedSacs: number;
  yieldLitersPerSac: number;
  cherryPct: number;
  greenPct: number;
  floaterPct: number;
  dryPct: number;
  destination: string | null;
  destinationLabel: string | null;
  destinationName: string | null;
  numberOfHarvesters: number | null;
  harvestersProductivity: number | null;
  isSpecialLot: boolean;
  microlotCode: string | null;
  // US-098 CA2 — commercial conversions
  commercialUnits?: {
    L: number;
    sc: number;
    kg: number;
    arroba: number;
    t: number;
  };
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoffeeHarvestsResponse {
  data: CoffeeHarvestItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCoffeeHarvestInput {
  fieldPlotId: string;
  cultivarId?: string;
  harvestDate: string;
  harvestType: string;
  volumeLiters: number;
  sacsBenefited?: number;
  yieldLitersPerSac?: number;
  cherryPct?: number;
  greenPct?: number;
  floaterPct?: number;
  dryPct?: number;
  destination?: string;
  destinationName?: string;
  numberOfHarvesters?: number;
  harvestersProductivity?: number;
  isSpecialLot?: boolean;
  microlotCode?: string;
  notes?: string;
}

export const HARVEST_TYPES = [
  { value: 'MECANIZADA', label: 'Mecanizada' },
  { value: 'DERRICA_MANUAL', label: 'Derriça manual' },
  { value: 'SELETIVA_CATACAO', label: 'Seletiva/Catação' },
];

export const COFFEE_DESTINATIONS = [
  { value: 'TERREIRO', label: 'Terreiro' },
  { value: 'SECADOR_MECANICO', label: 'Secador mecânico' },
  { value: 'LAVADOR_SEPARADOR', label: 'Lavador/Separador' },
];

export const HARVEST_TYPE_LABELS: Record<string, string> = {
  MECANIZADA: 'Mecanizada',
  DERRICA_MANUAL: 'Derriça manual',
  SELETIVA_CATACAO: 'Seletiva/Catação',
};

export const DESTINATION_LABELS: Record<string, string> = {
  TERREIRO: 'Terreiro',
  SECADOR_MECANICO: 'Secador mecânico',
  LAVADOR_SEPARADOR: 'Lavador/Separador',
};
