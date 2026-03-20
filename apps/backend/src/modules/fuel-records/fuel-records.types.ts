// ─── Error ──────────────────────────────────────────────────────────

export class FuelRecordError extends Error {
  public data?: Record<string, unknown>;
  constructor(
    message: string,
    public statusCode: number,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FuelRecordError';
    this.data = data;
  }
}

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreateFuelRecordInput {
  assetId: string;
  farmId: string;
  fuelDate: string | Date;
  liters: number | string;
  pricePerLiter: number | string;
  hourmeterAtFuel?: number | string;
  odometerAtFuel?: number | string;
  notes?: string;
}

export interface ListFuelRecordsQuery {
  assetId?: string;
  farmId?: string;
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface FuelStatsResult {
  assetAvgLitersPerHour: number | null;
  fleetAvgLitersPerHour: number | null;
  assetCostPerHour: number | null;
  fleetCostPerHour: number | null;
  totalLiters: number;
  totalCost: number;
  recordCount: number;
}
