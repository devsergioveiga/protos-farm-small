// ─── Error ──────────────────────────────────────────────────────────

export class AssetTransferError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AssetTransferError';
  }
}

// ─── Input Types ──────────────────────────────────────────────────────

export interface CreateTransferInput {
  toFarmId: string;
  transferDate: string; // ISO 8601
  toCostCenterId?: string;
  notes?: string;
}

// ─── Output Types ─────────────────────────────────────────────────────

export interface TransferOutput {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  fromFarmId: string;
  fromFarmName: string;
  toFarmId: string;
  toFarmName: string;
  transferDate: string;
  fromCostCenterId: string | null;
  toCostCenterId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ListTransfersQuery {
  page?: number;
  limit?: number;
}
