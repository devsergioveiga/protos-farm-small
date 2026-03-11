// ─── Error ──────────────────────────────────────────────────────────

export class ProductivityMapError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ProductivityMapError';
  }
}

// ─── Response Types ─────────────────────────────────────────────────

export type CultureType = 'GRAOS' | 'CAFE';

export interface PlotProductivity {
  fieldPlotId: string;
  fieldPlotName: string;
  fieldPlotAreaHa: number;
  cultureType: CultureType;
  crop: string;
  totalProduction: number;
  productionUnit: string;
  productivityPerHa: number;
  productivityUnit: string;
  harvestCount: number;
  dateRange: {
    first: string;
    last: string;
  };
}

export type ProductivityLevel = 'ALTA' | 'MEDIA' | 'BAIXA' | 'SEM_DADOS';

export interface PlotProductivityWithLevel extends PlotProductivity {
  level: ProductivityLevel;
  deviationFromAvg: number;
}

export interface ProductivityMapResponse {
  plots: PlotProductivityWithLevel[];
  summary: {
    totalPlots: number;
    plotsWithData: number;
    avgProductivityPerHa: number;
    productivityUnit: string;
    levels: Record<ProductivityLevel, number>;
  };
  filters: {
    cultureType: CultureType | null;
    crop: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
}
