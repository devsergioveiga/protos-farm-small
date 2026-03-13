// ─── Error ──────────────────────────────────────────────────────────

export class CoffeeHarvestError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'CoffeeHarvestError';
  }
}

// ─── Constants (CA1) ────────────────────────────────────────────────

/** Tipos de colheita de café */
export const HARVEST_TYPES = ['MECANIZADA', 'DERRICA_MANUAL', 'SELETIVA_CATACAO'] as const;

export const HARVEST_TYPE_LABELS: Record<string, string> = {
  MECANIZADA: 'Mecanizada',
  DERRICA_MANUAL: 'Derriça manual',
  SELETIVA_CATACAO: 'Seletiva/Catação',
};

/** CA5 — Destinos válidos */
export const DESTINATIONS = ['TERREIRO', 'SECADOR_MECANICO', 'LAVADOR_SEPARADOR'] as const;

export const DESTINATION_LABELS: Record<string, string> = {
  TERREIRO: 'Terreiro',
  SECADOR_MECANICO: 'Secador mecânico',
  LAVADOR_SEPARADOR: 'Lavador/Separador',
};

/** CA2 — Peso de 1 saca em kg */
export const SACA_KG = 60;

/** Peso de 1 arroba em kg */
export const ARROBA_KG = 15;

/** CA3 — Rendimento padrão (litros de café cereja para 1 saca beneficiada) */
export const DEFAULT_YIELD_LITERS_PER_SAC = 480;

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateCoffeeHarvestInput {
  id?: string;
  fieldPlotId: string;
  cultivarId?: string | null;
  harvestDate: string;
  harvestType: string;
  // CA2 — volume
  volumeLiters: number;
  sacsBenefited?: number | null;
  // CA3 — rendimento
  yieldLitersPerSac?: number | null;
  // CA4 — classificação
  cherryPct?: number;
  greenPct?: number;
  floaterPct?: number;
  dryPct?: number;
  // CA5 — destino
  destination?: string | null;
  destinationName?: string | null;
  // CA6 — equipe
  numberOfHarvesters?: number | null;
  harvestersProductivity?: number | null;
  // CA7 — café especial
  isSpecialLot?: boolean;
  microlotCode?: string | null;
  notes?: string | null;
}

// ─── Response Types ─────────────────────────────────────────────────

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
  // CA2
  volumeLiters: number;
  sacsBenefited: number | null;
  estimatedSacs: number;
  // CA3
  yieldLitersPerSac: number;
  // CA4
  cherryPct: number;
  greenPct: number;
  floaterPct: number;
  dryPct: number;
  // CA5
  destination: string | null;
  destinationLabel: string | null;
  destinationName: string | null;
  // CA6
  numberOfHarvesters: number | null;
  harvestersProductivity: number | null;
  // CA7
  isSpecialLot: boolean;
  microlotCode: string | null;
  // US-098 CA2 — commercial conversions
  commercialUnits: CoffeeCommercialUnits;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

// US-098 CA2 — commercial unit conversions for coffee
export interface CoffeeCommercialUnits {
  L: number;
  sc: number;
  kg: number;
  arroba: number;
  t: number;
}

// CA6 — daily summary by plot
export interface PlotDailySummary {
  fieldPlotId: string;
  fieldPlotName: string;
  date: string;
  totalVolumeLiters: number;
  totalEstimatedSacs: number;
  totalHarvesters: number;
  avgProductivity: number;
  entries: number;
}
