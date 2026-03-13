// US-098 — Conversão em comercialização e produção

export class HarvestConversionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'HarvestConversionError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const HARVEST_TYPES = ['GRAIN', 'COFFEE', 'ORANGE'] as const;
export type HarvestCropType = (typeof HARVEST_TYPES)[number];

/** Weight-based conversion factors (to kg) */
export const UNIT_TO_KG: Record<string, number> = {
  kg: 1,
  g: 0.001,
  t: 1000,
  sc: 60,
  '@': 15,
  cx: 40.8,
};

/** Volume units (no weight conversion without density) */
export const VOLUME_UNITS = ['L', 'mL'] as const;

/** All supported commercial unit abbreviations */
export const COMMERCIAL_UNIT_ABBREVS = ['kg', 'sc', '@', 't', 'cx', 'L'] as const;

export const COMMERCIAL_UNIT_LABELS: Record<string, string> = {
  kg: 'Quilogramas',
  sc: 'Sacas (60 kg)',
  '@': 'Arrobas (15 kg)',
  t: 'Toneladas',
  cx: 'Caixas (40,8 kg)',
  L: 'Litros',
};

// ─── CA5: Conversion endpoint types ───────────────────────────────

export interface ConvertHarvestQuery {
  harvestType: string;
  quantity: number;
  fromUnit: string;
  toUnit: string;
  /** For coffee L → kg/sc conversions: liters per sac yield */
  yieldLitersPerSac?: number;
}

export interface ConvertHarvestResult {
  originalQuantity: number;
  originalUnit: string;
  originalUnitLabel: string;
  convertedQuantity: number;
  targetUnit: string;
  targetUnitLabel: string;
  conversionFactor: number;
  formula: string;
}

// ─── CA6: Production report types ─────────────────────────────────

export interface ProductionReportQuery {
  dateFrom?: string;
  dateTo?: string;
  fieldPlotId?: string;
  crop?: string;
  unit?: string;
}

export interface ProductionReportItem {
  fieldPlotId: string;
  fieldPlotName: string;
  crop: string;
  harvestType: HarvestCropType;
  totalEntries: number;
  totalAreaHa: number;
  production: {
    kg: number;
    sc: number;
    arroba: number;
    t: number;
  };
  targetQuantity: number;
  targetUnit: string;
  targetUnitLabel: string;
  productivityPerHa: number;
}

export interface ProductionReport {
  farmId: string;
  farmName: string;
  dateFrom: string | null;
  dateTo: string | null;
  targetUnit: string;
  targetUnitLabel: string;
  items: ProductionReportItem[];
  totals: {
    totalEntries: number;
    totalAreaHa: number;
    totalProduction: number;
    avgProductivityPerHa: number;
  };
}

// ─── CA7: Delivery manifest (romaneio) types ─────────────────────

export interface DeliveryManifestInput {
  harvestType: string;
  harvestIds: string[];
  targetUnit: string;
  deliveryDate: string;
  recipient?: string;
  transporterName?: string;
  vehiclePlate?: string;
  notes?: string;
}

export interface DeliveryManifestLineItem {
  harvestId: string;
  fieldPlotName: string;
  harvestDate: string;
  originalQuantity: number;
  originalUnit: string;
  convertedQuantity: number;
  targetUnit: string;
}

export interface DeliveryManifest {
  manifestNumber: string;
  farmId: string;
  farmName: string;
  deliveryDate: string;
  recipient: string | null;
  transporterName: string | null;
  vehiclePlate: string | null;
  targetUnit: string;
  targetUnitLabel: string;
  items: DeliveryManifestLineItem[];
  totalConverted: number;
  notes: string | null;
  generatedAt: string;
}
