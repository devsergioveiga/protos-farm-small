// ─── Error ──────────────────────────────────────────────────────────

export class OrangeHarvestError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'OrangeHarvestError';
  }
}

// ─── Constants (CA1) ────────────────────────────────────────────────

/** Peso padrão de 1 caixa de laranja em kg */
export const BOX_WEIGHT_KG = 40.8;

// ─── CA4 — Destinos válidos ─────────────────────────────────────────

export const DESTINATIONS = ['INDUSTRIA', 'IN_NATURA', 'DESCARTE'] as const;

export const DESTINATION_LABELS: Record<string, string> = {
  INDUSTRIA: 'Indústria',
  IN_NATURA: 'Mercado in natura',
  DESCARTE: 'Descarte',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateOrangeHarvestInput {
  id?: string;
  fieldPlotId: string;
  cultivarId?: string | null;
  harvestDate: string;
  variety?: string | null;
  // CA1 — produção
  numberOfBoxes: number;
  totalWeightKg?: number | null;
  treesHarvested?: number | null;
  // CA3 — qualidade
  ratioSS?: number | null;
  acidityPct?: number | null;
  refusalPct?: number | null;
  // CA4 — destino
  destination?: string | null;
  destinationName?: string | null;
  // CA5 — equipe
  numberOfHarvesters?: number | null;
  harvestersProductivity?: number | null;
  // CA6 — contrato
  saleContractRef?: string | null;
  notes?: string | null;
}

// ─── Response Types ─────────────────────────────────────────────────

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
  // CA1
  numberOfBoxes: number;
  totalWeightKg: number;
  treesHarvested: number | null;
  // CA2 — calculados
  boxesPerTree: number | null;
  boxesPerHa: number | null;
  tonsPerHa: number | null;
  // CA3
  ratioSS: number | null;
  acidityPct: number | null;
  refusalPct: number | null;
  // CA4
  destination: string | null;
  destinationLabel: string | null;
  destinationName: string | null;
  // CA5
  numberOfHarvesters: number | null;
  harvestersProductivity: number | null;
  // CA6
  saleContractRef: string | null;
  // US-098 CA3 — commercial conversions
  commercialUnits: OrangeCommercialUnits;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

// US-098 CA3 — commercial unit conversions for orange
export interface OrangeCommercialUnits {
  cx: number;
  kg: number;
  t: number;
}

// CA5 — daily summary by plot
export interface PlotDailySummary {
  fieldPlotId: string;
  fieldPlotName: string;
  date: string;
  totalBoxes: number;
  totalWeightKg: number;
  totalHarvesters: number;
  avgProductivity: number;
  entries: number;
}
