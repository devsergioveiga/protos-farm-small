// ─── Error ────────────────────────────────────────────────────────────

export class BiologicalAssetError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'BiologicalAssetError';
  }
}

// ─── Group Types ──────────────────────────────────────────────────────

export type GroupType = 'ANIMAL' | 'PERENNIAL_CROP';

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  ANIMAL: 'Rebanho',
  PERENNIAL_CROP: 'Cultura Perene',
};

export const ANIMAL_GROUPS = [
  'BEZERRO',
  'BEZERRA',
  'NOVILHA',
  'NOVILHO',
  'VACA_LACTACAO',
  'VACA_SECA',
  'TOURO_REPRODUTOR',
  'DESCARTE',
] as const;

export const PERENNIAL_CROP_GROUPS = [
  'CAFE_FORMACAO',
  'LARANJA_FORMACAO',
  'EUCALIPTO_FORMACAO',
  'SERINGUEIRA_FORMACAO',
  'OUTRO_PERENE',
] as const;

// ─── Input / Output Types ─────────────────────────────────────────────

export interface CreateValuationInput {
  farmId: string;
  valuationDate: string; // ISO 8601
  assetGroup: string;
  groupType: GroupType;
  headCount?: number;
  areaHa?: number;
  pricePerUnit: number;
  totalFairValue: number;
  notes?: string;
}

export interface ValuationOutput {
  id: string;
  organizationId: string;
  farmId: string;
  farmName: string;
  valuationDate: string;
  assetGroup: string;
  groupType: GroupType;
  groupTypeLabel: string;
  headCount: number | null;
  areaHa: number | null;
  pricePerUnit: number;
  totalFairValue: number;
  previousValue: number | null;
  fairValueChange: number | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ValuationSummaryItem {
  assetGroup: string;
  groupType: GroupType;
  latestTotalFairValue: number;
  latestFairValueChange: number | null;
  valuationCount: number;
}

export interface ListValuationsFilters {
  farmId?: string;
  assetGroup?: string;
  groupType?: string;
}
