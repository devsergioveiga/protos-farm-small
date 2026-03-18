export interface FeedIngredientItem {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  subtype: string | null;
  measurementUnit: string;
  costPerKg: number | null;
  refDmPercent: number | null;
  refCpPercent: number | null;
  refNdfPercent: number | null;
  refTdnPercent: number | null;
  refNelMcalKg: number | null;
  latestAnalysis: AnalysisItem | null;
  analysisCount: number;
  notes: string | null;
  createdAt: string;
}

export interface AnalysisItem {
  id: string;
  feedIngredientId: string;
  batchNumber: string | null;
  collectionDate: string;
  resultDate: string | null;
  laboratory: string | null;
  dmPercent: number | null;
  cpPercent: number | null;
  ndfPercent: number | null;
  adfPercent: number | null;
  eePercent: number | null;
  tdnPercent: number | null;
  nelMcalKg: number | null;
  caPercent: number | null;
  pPercent: number | null;
  reportFileName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ComparisonItem {
  param: string;
  label: string;
  unit: string;
  reference: number | null;
  actual: number | null;
  deviation: number | null;
  status: 'NORMAL' | 'LOW' | 'HIGH';
}

export interface QualityTrendPoint {
  date: string;
  dmPercent: number | null;
  cpPercent: number | null;
  ndfPercent: number | null;
  tdnPercent: number | null;
  nelMcalKg: number | null;
}

export interface FeedIngredientsResponse {
  data: FeedIngredientItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface AnalysesResponse {
  data: AnalysisItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateFeedIngredientInput {
  name: string;
  type: string;
  subtype?: string | null;
  measurementUnit?: string;
  costPerKg?: number | null;
  refDmPercent?: number | null;
  refCpPercent?: number | null;
  refNdfPercent?: number | null;
  refTdnPercent?: number | null;
  refNelMcalKg?: number | null;
  notes?: string | null;
}

export interface CreateAnalysisInput {
  batchNumber?: string | null;
  collectionDate: string;
  resultDate?: string | null;
  laboratory?: string | null;
  responsibleName: string;
  dmPercent?: number | null;
  cpPercent?: number | null;
  ndfPercent?: number | null;
  adfPercent?: number | null;
  eePercent?: number | null;
  tdnPercent?: number | null;
  nelMcalKg?: number | null;
  caPercent?: number | null;
  pPercent?: number | null;
  notes?: string | null;
}

export const FEED_TYPES = [
  { value: 'ROUGHAGE', label: 'Volumoso' },
  { value: 'CONCENTRATE', label: 'Concentrado' },
  { value: 'MINERAL', label: 'Mineral' },
  { value: 'ADDITIVE', label: 'Aditivo' },
  { value: 'BYPRODUCT', label: 'Subproduto' },
] as const;

export interface ImportResult {
  imported: number;
  errors: Array<{ row: number; message: string }>;
}
