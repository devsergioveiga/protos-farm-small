export type RepairAlert = 'OK' | 'MONITOR' | 'REPLACE' | 'NO_DATA';

export interface InventoryReportQuery {
  organizationId: string;
  farmId?: string;
  assetType?: string;
  dateFrom?: string; // ISO date — filters acquisitions/disposals in period
  dateTo?: string;
}

export interface InventoryReportRow {
  classification: string;
  count: number;
  grossValue: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  acquisitionsInPeriod: number; // count of assets acquired in dateFrom..dateTo
  disposalsInPeriod: number; // count of assets disposed in dateFrom..dateTo
}

export interface InventoryReportResult {
  rows: InventoryReportRow[];
  totals: {
    count: number;
    grossValue: number;
    accumulatedDepreciation: number;
    netBookValue: number;
  };
  generatedAt: string;
}

export interface DepreciationProjectionQuery {
  organizationId: string;
  horizonMonths: 12 | 36 | 60;
  farmId?: string;
  assetType?: string;
}

export interface DepreciationProjectionRow {
  year: number;
  month: number;
  projectedDepreciation: number;
  cumulativeDepreciation: number;
  remainingBookValue: number;
}

export interface DepreciationProjectionResult {
  rows: DepreciationProjectionRow[];
  assetsIncluded: number;
  assetsEstimated: number; // those using fallback STRAIGHT_LINE for HOURS/UNITS methods
  generatedAt: string;
}

export interface TCOFleetQuery {
  organizationId: string;
  farmId?: string;
  assetType?: string;
}

export interface TCOFleetRow {
  assetId: string;
  assetName: string;
  assetTag: string;
  assetType: string;
  acquisitionValue: number;
  accumulatedDepreciation: number;
  maintenanceCost: number;
  fuelCost: number;
  totalCost: number;
  repairRatio: number | null;
  alert: RepairAlert;
  costPerHour: number | null;
}

export interface TCOFleetResult {
  assets: TCOFleetRow[];
  summary: {
    avgCostPerHour: number | null;
    totalMaintenanceCost: number;
    totalFuelCost: number;
  };
  generatedAt: string;
}

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';
