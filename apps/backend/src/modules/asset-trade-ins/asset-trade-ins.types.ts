// ─── Error ──────────────────────────────────────────────────────────

export class AssetTradeInError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AssetTradeInError';
  }
}

// ─── Input Types ──────────────────────────────────────────────────────

export interface CreateTradeInInput {
  farmId: string;
  tradedAssetId: string;       // existing asset to trade in
  tradeInDate: string;         // ISO 8601
  tradedAssetValue: number;    // agreed value for old asset
  // New asset data:
  newAssetType: string;        // AssetType enum value
  newAssetClassification: string; // AssetClassification enum value
  newAssetName: string;
  newAssetValue: number;       // price of new asset
  newAssetAcquisitionDate?: string;
  supplierName?: string;
  dueDate?: string;            // for CP if netPayable > 0
  notes?: string;
}

// ─── Output Types ─────────────────────────────────────────────────────

export interface TradeInOutput {
  id: string;
  organizationId: string;
  farmId: string;
  farmName: string;
  tradedAssetId: string;
  tradedAssetTag: string;
  tradedAssetName: string;
  newAssetId: string;
  newAssetTag: string;
  newAssetName: string;
  tradeInDate: string;
  tradedAssetValue: number;
  newAssetValue: number;
  netPayable: number;
  gainLossOnTrade: number;
  payableId: string | null;
  supplierName: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}
