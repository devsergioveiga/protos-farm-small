// ─── Error ──────────────────────────────────────────────────────────

export class GrainHarvestError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'GrainHarvestError';
  }
}

// ─── Constants (CA2) ────────────────────────────────────────────────

/** Umidade padrão de comercialização por cultura (%) */
export const STANDARD_MOISTURE: Record<string, number> = {
  SOJA: 13,
  MILHO: 14,
  FEIJAO: 13,
  FEIJÃO: 13,
  TRIGO: 13,
  SORGO: 13,
  ARROZ: 13,
};

/** Peso de 1 saca em kg */
export const SACA_KG = 60;

/** CA5 — Destinos válidos */
export const DESTINATIONS = ['SILO_PROPRIO', 'ARMAZEM_TERCEIRO', 'VENDA_DIRETA'] as const;

export const DESTINATION_LABELS: Record<string, string> = {
  SILO_PROPRIO: 'Silo próprio',
  ARMAZEM_TERCEIRO: 'Armazém terceiro',
  VENDA_DIRETA: 'Venda direta',
};

/** CA6 — Métodos de pesagem */
export const WEIGHING_METHODS = ['MANUAL', 'BALANCA'] as const;

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateGrainHarvestInput {
  id?: string;
  fieldPlotId: string;
  cultivarId?: string | null;
  crop: string;
  harvestDate: string;
  harvestedAreaHa: number;
  grossProductionKg: number;
  moisturePct: number;
  impurityPct: number;
  // CA4 — colheitadeira e operador
  harvesterName?: string | null;
  operatorName?: string | null;
  // CA5 — destino
  destination?: string | null;
  destinationName?: string | null;
  romaneioNumber?: string | null;
  // CA6 — pesagem
  grossWeightKg?: number | null;
  tareWeightKg?: number | null;
  netWeightKg?: number | null;
  weighingMethod?: string | null;
  // CA8 — marcar colheita completa no talhão
  harvestComplete?: boolean;
  // CA9 — custo de colheita
  harvesterHours?: number | null;
  harvesterCostPerHour?: number | null;
  transhipmentCost?: number | null;
  transportCost?: number | null;
  notes?: string | null;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface GrainHarvestItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  fieldPlotAreaHa: number;
  cultivarId: string | null;
  cultivarName: string | null;
  crop: string;
  harvestDate: string;
  harvestedAreaHa: number;
  grossProductionKg: number;
  moisturePct: number;
  impurityPct: number;
  // CA7
  loadNumber: number;
  // CA2 — computed productivity
  standardMoisturePct: number;
  netProductionKg: number;
  correctedProductionKg: number;
  productionSc: number;
  productivityScHa: number;
  // CA4
  harvesterName: string | null;
  operatorName: string | null;
  // CA5
  destination: string | null;
  destinationLabel: string | null;
  destinationName: string | null;
  romaneioNumber: string | null;
  // CA6
  grossWeightKg: number | null;
  tareWeightKg: number | null;
  netWeightKg: number | null;
  weighingMethod: string | null;
  // CA9
  harvesterHours: number | null;
  harvesterCostPerHour: number | null;
  transhipmentCost: number | null;
  transportCost: number | null;
  totalHarvestCost: number | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

// CA7 — plot accumulation summary
export interface PlotHarvestSummary {
  fieldPlotId: string;
  fieldPlotName: string;
  totalLoads: number;
  totalGrossProductionKg: number;
  totalHarvestedAreaHa: number;
}

// CA9 — cost summary by plot
export interface PlotCostSummary {
  fieldPlotId: string;
  fieldPlotName: string;
  totalLoads: number;
  totalHarvestedAreaHa: number;
  totalHarvesterCost: number;
  totalTranshipmentCost: number;
  totalTransportCost: number;
  totalCost: number;
  costPerHa: number;
  costPerSc: number;
  totalProductionSc: number;
}
