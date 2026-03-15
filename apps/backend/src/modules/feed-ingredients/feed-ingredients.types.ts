// ─── Error ──────────────────────────────────────────────────────────

export class FeedIngredientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FeedIngredientError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const FEED_INGREDIENT_TYPES = [
  'ROUGHAGE',
  'CONCENTRATE',
  'MINERAL',
  'ADDITIVE',
  'BYPRODUCT',
] as const;
export type FeedIngredientType = (typeof FEED_INGREDIENT_TYPES)[number];

export const FEED_TYPE_LABELS: Record<FeedIngredientType, string> = {
  ROUGHAGE: 'Volumoso',
  CONCENTRATE: 'Concentrado',
  MINERAL: 'Mineral',
  ADDITIVE: 'Aditivo',
  BYPRODUCT: 'Subproduto',
};

export const COMMON_SUBTYPES: Record<FeedIngredientType, string[]> = {
  ROUGHAGE: [
    'silagem_milho',
    'silagem_sorgo',
    'silagem_capim',
    'feno_tifton',
    'feno_coast_cross',
    'feno_alfafa',
    'cana_de_acucar',
    'capim_fresco',
    'bagaco_cana',
  ],
  CONCENTRATE: [
    'milho_grao',
    'farelo_soja',
    'farelo_algodao',
    'farelo_trigo',
    'farelo_amendoim',
    'polpa_citrica',
    'casca_soja',
    'graos_destilaria',
    'milho_floculado',
    'sorgo_grao',
  ],
  MINERAL: [
    'sal_mineral',
    'sal_proteinado',
    'fosfato_bicalcico',
    'calcario_calcitico',
    'nucleo_mineral',
    'premix_vitaminico',
  ],
  ADDITIVE: [
    'ureia',
    'bicarbonato_sodio',
    'levedura',
    'ionoforo',
    'tamponante',
    'probiotico',
    'enzima',
    'adsorvente_micotoxinas',
  ],
  BYPRODUCT: [
    'torta_algodao',
    'farelo_arroz',
    'casca_cafe',
    'residuo_cervejaria',
    'bagaco_cevada',
    'polpa_beterraba',
    'glicerina',
    'gordura_protegida',
  ],
};

// Nutritional parameter keys
export const NUTRITIONAL_PARAMS = [
  'dmPercent',
  'cpPercent',
  'ndfPercent',
  'adfPercent',
  'eePercent',
  'mmPercent',
  'tdnPercent',
  'nelMcalKg',
  'nfcPercent',
  'caPercent',
  'pPercent',
  'mgPercent',
  'kPercent',
  'naPercent',
] as const;
export type NutritionalParam = (typeof NUTRITIONAL_PARAMS)[number];

export const NUTRITIONAL_PARAM_LABELS: Record<NutritionalParam, string> = {
  dmPercent: 'Matéria Seca (%)',
  cpPercent: 'Proteína Bruta (%)',
  ndfPercent: 'FDN (%)',
  adfPercent: 'FDA (%)',
  eePercent: 'Extrato Etéreo (%)',
  mmPercent: 'Matéria Mineral (%)',
  tdnPercent: 'NDT (%)',
  nelMcalKg: 'ELl (Mcal/kg)',
  nfcPercent: 'CNF (%)',
  caPercent: 'Cálcio (%)',
  pPercent: 'Fósforo (%)',
  mgPercent: 'Magnésio (%)',
  kPercent: 'Potássio (%)',
  naPercent: 'Sódio (%)',
};

// Reference param field mapping (ref* fields on FeedIngredient)
export const REF_PARAM_MAP: Record<NutritionalParam, string> = {
  dmPercent: 'refDmPercent',
  cpPercent: 'refCpPercent',
  ndfPercent: 'refNdfPercent',
  adfPercent: 'refAdfPercent',
  eePercent: 'refEePercent',
  mmPercent: 'refMmPercent',
  tdnPercent: 'refTdnPercent',
  nelMcalKg: 'refNelMcalKg',
  nfcPercent: 'refNfcPercent',
  caPercent: 'refCaPercent',
  pPercent: 'refPPercent',
  mgPercent: 'refMgPercent',
  kPercent: 'refKPercent',
  naPercent: 'refNaPercent',
};

// Deviation thresholds (CA5)
export const DEVIATION_THRESHOLDS = {
  WARNING: 10, // 10% deviation = warning
  CRITICAL: 20, // 20% deviation = critical
} as const;

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateFeedIngredientInput {
  name: string;
  type: string;
  subtype?: string | null;
  measurementUnit?: string;
  costPerKg?: number | null;
  refDmPercent?: number | null;
  refCpPercent?: number | null;
  refNdfPercent?: number | null;
  refAdfPercent?: number | null;
  refEePercent?: number | null;
  refMmPercent?: number | null;
  refTdnPercent?: number | null;
  refNelMcalKg?: number | null;
  refNfcPercent?: number | null;
  refCaPercent?: number | null;
  refPPercent?: number | null;
  refMgPercent?: number | null;
  refKPercent?: number | null;
  refNaPercent?: number | null;
  notes?: string | null;
}

export type UpdateFeedIngredientInput = Partial<CreateFeedIngredientInput>;

export interface ListFeedIngredientsQuery {
  page?: number;
  limit?: number;
  type?: string;
  subtype?: string;
  search?: string;
}

export interface CreateAnalysisInput {
  feedIngredientId: string;
  batchNumber?: string | null;
  collectionDate: string; // ISO date
  resultDate?: string | null;
  laboratory?: string | null;
  protocolNumber?: string | null;
  responsibleName: string;
  dmPercent?: number | null;
  cpPercent?: number | null;
  ndfPercent?: number | null;
  adfPercent?: number | null;
  eePercent?: number | null;
  mmPercent?: number | null;
  tdnPercent?: number | null;
  nelMcalKg?: number | null;
  nfcPercent?: number | null;
  caPercent?: number | null;
  pPercent?: number | null;
  mgPercent?: number | null;
  kPercent?: number | null;
  naPercent?: number | null;
  notes?: string | null;
}

export type UpdateAnalysisInput = Partial<Omit<CreateAnalysisInput, 'feedIngredientId'>>;

export interface ListAnalysesQuery {
  feedIngredientId?: string;
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface FeedIngredientItem {
  id: string;
  organizationId: string;
  name: string;
  type: FeedIngredientType;
  typeLabel: string;
  subtype: string | null;
  measurementUnit: string;
  costPerKg: number | null;
  refDmPercent: number | null;
  refCpPercent: number | null;
  refNdfPercent: number | null;
  refAdfPercent: number | null;
  refEePercent: number | null;
  refMmPercent: number | null;
  refTdnPercent: number | null;
  refNelMcalKg: number | null;
  refNfcPercent: number | null;
  refCaPercent: number | null;
  refPPercent: number | null;
  refMgPercent: number | null;
  refKPercent: number | null;
  refNaPercent: number | null;
  analysisCount: number;
  latestAnalysisDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListFeedIngredientsResult {
  data: FeedIngredientItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AnalysisItem {
  id: string;
  organizationId: string;
  feedIngredientId: string;
  feedIngredientName: string;
  batchNumber: string | null;
  collectionDate: string;
  resultDate: string | null;
  laboratory: string | null;
  protocolNumber: string | null;
  responsibleName: string;
  dmPercent: number | null;
  cpPercent: number | null;
  ndfPercent: number | null;
  adfPercent: number | null;
  eePercent: number | null;
  mmPercent: number | null;
  tdnPercent: number | null;
  nelMcalKg: number | null;
  nfcPercent: number | null;
  caPercent: number | null;
  pPercent: number | null;
  mgPercent: number | null;
  kPercent: number | null;
  naPercent: number | null;
  reportFileName: string | null;
  reportPath: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAnalysesResult {
  data: AnalysisItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// CA5: Comparison result
export type DeviationLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface ParamComparison {
  param: NutritionalParam;
  label: string;
  referenceValue: number | null;
  analysisValue: number | null;
  deviationPercent: number | null;
  level: DeviationLevel;
}

export interface ComparisonResult {
  analysisId: string;
  feedIngredientId: string;
  feedIngredientName: string;
  comparisons: ParamComparison[];
}

// CA7: Quality trend
export interface QualityTrendPoint {
  analysisId: string;
  collectionDate: string;
  dmPercent: number | null;
  cpPercent: number | null;
  ndfPercent: number | null;
  tdnPercent: number | null;
  nelMcalKg: number | null;
  costPerKgDm: number | null;
  costPerKgCp: number | null;
}

export interface QualityTrendResult {
  feedIngredientId: string;
  feedIngredientName: string;
  points: QualityTrendPoint[];
}

// CA6: Import result
export interface ImportAnalysesResult {
  imported: number;
  skipped: number;
  errors: string[];
}
