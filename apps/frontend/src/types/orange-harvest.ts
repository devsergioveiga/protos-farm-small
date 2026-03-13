export interface OrangeHarvestItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  fieldPlotAreaHa: number;
  cultivarId: string | null;
  cultivarName: string | null;
  harvestDate: string;
  variety: string | null;
  numberOfBoxes: number;
  totalWeightKg: number;
  treesHarvested: number | null;
  boxesPerTree: number | null;
  boxesPerHa: number | null;
  tonsPerHa: number | null;
  ratioSS: number | null;
  acidityPct: number | null;
  refusalPct: number | null;
  destination: string | null;
  destinationLabel: string | null;
  destinationName: string | null;
  numberOfHarvesters: number | null;
  harvestersProductivity: number | null;
  saleContractRef: string | null;
  // US-098 CA3 — commercial conversions
  commercialUnits?: {
    cx: number;
    kg: number;
    t: number;
  };
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrangeHarvestsResponse {
  data: OrangeHarvestItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateOrangeHarvestInput {
  fieldPlotId: string;
  cultivarId?: string;
  harvestDate: string;
  variety?: string;
  numberOfBoxes: number;
  totalWeightKg?: number;
  treesHarvested?: number;
  ratioSS?: number;
  acidityPct?: number;
  refusalPct?: number;
  destination?: string;
  destinationName?: string;
  numberOfHarvesters?: number;
  harvestersProductivity?: number;
  saleContractRef?: string;
  notes?: string;
}

export const ORANGE_DESTINATIONS = [
  { value: 'INDUSTRIA', label: 'Indústria' },
  { value: 'IN_NATURA', label: 'Mercado in natura' },
  { value: 'DESCARTE', label: 'Descarte' },
];

export const DESTINATION_LABELS: Record<string, string> = {
  INDUSTRIA: 'Indústria',
  IN_NATURA: 'Mercado in natura',
  DESCARTE: 'Descarte',
};

/** Peso padrão de 1 caixa de laranja em kg */
export const BOX_WEIGHT_KG = 40.8;
