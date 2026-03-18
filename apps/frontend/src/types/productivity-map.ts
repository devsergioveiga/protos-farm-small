export type CultureType = 'GRAOS' | 'CAFE';
export type ProductivityLevel = 'ALTA' | 'MEDIA' | 'BAIXA' | 'SEM_DADOS';

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
  level: ProductivityLevel;
  deviationFromAvg: number;
  dateRange: {
    first: string;
    last: string;
  };
}

export interface ProductivityMapSummary {
  totalPlots: number;
  plotsWithData: number;
  avgProductivityPerHa: number;
  productivityUnit: string;
  levels: Record<ProductivityLevel, number>;
}

export interface ProductivityMapResponse {
  plots: PlotProductivity[];
  summary: ProductivityMapSummary;
  filters: {
    cultureType: CultureType | null;
    crop: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
}

export interface SeasonEntry {
  season: string;
  productivityPerHa: number;
  productivityUnit: string;
  totalProduction: number;
  productionUnit: string;
  harvestCount: number;
}

export interface PlotSeasonComparison {
  fieldPlotId: string;
  fieldPlotName: string;
  fieldPlotAreaHa: number;
  seasons: SeasonEntry[];
  variationPct: number | null;
}
