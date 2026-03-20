// ─── Enums ─────────────────────────────────────────────────────────

export type AssetType = 'MAQUINA' | 'VEICULO' | 'IMPLEMENTO' | 'BENFEITORIA' | 'TERRA';

export type AssetClassification =
  | 'DEPRECIABLE_CPC27'
  | 'NON_DEPRECIABLE_CPC27'
  | 'FAIR_VALUE_CPC29'
  | 'BEARER_PLANT_CPC27';

export type AssetStatus = 'ATIVO' | 'INATIVO' | 'EM_MANUTENCAO' | 'ALIENADO' | 'EM_ANDAMENTO';

export type AssetDocumentType =
  | 'CRLV'
  | 'SEGURO'
  | 'REVISAO'
  | 'CCIR'
  | 'ITR'
  | 'LAUDO'
  | 'GARANTIA'
  | 'OUTRO';

// ─── Interfaces ──────────────────────────────────────────────────────

export interface Asset {
  id: string;
  organizationId: string;
  farmId: string;
  assetType: AssetType;
  classification: AssetClassification;
  status: AssetStatus;
  name: string;
  description: string | null;
  assetTag: string;
  acquisitionDate: string | null;
  acquisitionValue: string | null; // Decimal as string from API
  supplierId: string | null;
  invoiceNumber: string | null;
  costCenterId: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  yearOfManufacture: number | null;
  engineHp: string | null;
  fuelType: string | null;
  renavamCode: string | null;
  licensePlate: string | null;
  parentAssetId: string | null;
  constructionMaterial: string | null;
  areaM2: string | null;
  capacity: string | null;
  registrationNumber: string | null;
  areaHa: string | null;
  carCode: string | null;
  currentHourmeter: string | null;
  currentOdometer: string | null;
  photoUrls: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  farm?: { name: string };
  supplier?: { name: string };
  costCenter?: { name: string };
  parentAsset?: { id: string; name: string; assetTag: string } | null;
  childAssets?: Asset[];
  _count?: { fuelRecords: number; meterReadings: number; documents: number };
}

export interface CreateAssetInput {
  name: string;
  assetType: AssetType;
  classification: AssetClassification;
  farmId: string;
  description?: string;
  acquisitionDate?: string;
  acquisitionValue?: string;
  supplierId?: string;
  invoiceNumber?: string;
  costCenterId?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  yearOfManufacture?: number;
  engineHp?: string;
  fuelType?: string;
  renavamCode?: string;
  licensePlate?: string;
  parentAssetId?: string;
  constructionMaterial?: string;
  areaM2?: string;
  capacity?: string;
  geoLat?: number;
  geoLon?: number;
  registrationNumber?: string;
  areaHa?: string;
  carCode?: string;
  currentHourmeter?: string;
  currentOdometer?: string;
  notes?: string;
}

export type UpdateAssetInput = Partial<CreateAssetInput> & { status?: AssetStatus };

export interface AssetSummary {
  totalAssets: number;
  totalValue: string;
  inMaintenance: number;
  recentAcquisitions: Asset[];
}

export interface ListAssetsQuery {
  page?: number;
  limit?: number;
  farmId?: string;
  assetType?: AssetType;
  status?: AssetStatus;
  search?: string;
  minValue?: string;
  maxValue?: string;
  acquisitionFrom?: string;
  acquisitionTo?: string;
}

export interface AssetListResponse {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Labels ──────────────────────────────────────────────────────────

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  MAQUINA: 'Maquina',
  VEICULO: 'Veiculo',
  IMPLEMENTO: 'Implemento',
  BENFEITORIA: 'Benfeitoria',
  TERRA: 'Terra',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  EM_MANUTENCAO: 'Em manutencao',
  ALIENADO: 'Alienado',
  EM_ANDAMENTO: 'Em andamento',
};

export const ASSET_CLASSIFICATION_LABELS: Record<AssetClassification, string> = {
  DEPRECIABLE_CPC27: 'CPC 27 — Depreciavel',
  NON_DEPRECIABLE_CPC27: 'CPC 27 — Nao depreciavel',
  FAIR_VALUE_CPC29: 'CPC 29 — Valor justo',
  BEARER_PLANT_CPC27: 'CPC 27 — Planta portadora',
};
