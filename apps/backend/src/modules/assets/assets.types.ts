// ─── Error ──────────────────────────────────────────────────────────

export class AssetError extends Error {
  public data?: Record<string, unknown>;
  constructor(
    message: string,
    public statusCode: number,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AssetError';
    this.data = data;
  }
}

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreateAssetInput {
  name: string;
  assetType: string;
  classification: string;
  farmId: string;
  description?: string;
  acquisitionDate?: string | Date;
  acquisitionValue?: number | string;
  supplierId?: string;
  invoiceNumber?: string;
  costCenterId?: string;
  costCenterMode?: string;
  costCenterPercent?: number | string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  yearOfManufacture?: number;
  engineHp?: number | string;
  fuelType?: string;
  renavamCode?: string;
  licensePlate?: string;
  parentAssetId?: string;
  constructionMaterial?: string;
  areaM2?: number | string;
  capacity?: string;
  geoLat?: number;
  geoLon?: number;
  registrationNumber?: string;
  areaHa?: number | string;
  carCode?: string;
  currentHourmeter?: number | string;
  currentOdometer?: number | string;
  notes?: string;
}

export type UpdateAssetInput = Partial<CreateAssetInput> & {
  status?: string;
};

export interface ListAssetsQuery {
  page?: number;
  limit?: number;
  farmId?: string;
  assetType?: string;
  status?: string;
  search?: string;
  minValue?: number | string;
  maxValue?: number | string;
  acquisitionFrom?: string;
  acquisitionTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RlsContext {
  organizationId: string;
}
