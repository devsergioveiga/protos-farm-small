// ─── Error ──────────────────────────────────────────────────────────

export class ProductError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ProductError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const PRODUCT_NATURES = ['PRODUCT', 'SERVICE'] as const;
export type ProductNature = (typeof PRODUCT_NATURES)[number];

export const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_TYPES = [
  'semente',
  'fertilizante',
  'defensivo_herbicida',
  'defensivo_inseticida',
  'defensivo_fungicida',
  'defensivo_acaricida',
  'adjuvante',
  'corretivo_calcario',
  'corretivo_gesso',
  'inoculante',
  'biologico',
  'vacina',
  'medicamento_veterinario',
  'hormonio_reprodutivo',
  'suplemento_mineral_vitaminico',
  'semen',
  'combustivel',
  'peca_componente',
  'epi',
  'material_consumo',
  'outro',
] as const;

export const SERVICE_TYPES = [
  'consultoria_agronomica',
  'consultoria_veterinaria',
  'inseminacao_artificial',
  'analise_laboratorial',
  'transporte_leite',
  'frete_insumos',
  'manutencao_equipamento',
  'topografia_georreferenciamento',
  'assessoria_contabil_fiscal',
  'servico_maquinas_terceirizado',
  'certificacao_auditoria',
  'outro',
] as const;

export const CHARGE_UNITS = [
  'hora',
  'diaria',
  'visita',
  'hectare',
  'amostra',
  'km',
  'cabeca',
  'mes',
  'valor_fixo',
] as const;

export const TYPICAL_FREQUENCIES = [
  'avulso',
  'mensal',
  'quinzenal',
  'semanal',
  'por_demanda',
] as const;

// CA8: Defensivos
export const TOXICITY_CLASSES = ['I', 'II', 'III', 'IV', 'V'] as const;
export const ENVIRONMENTAL_CLASSES = ['I', 'II', 'III', 'IV'] as const;

// CA9: Fertilizantes
export const NUTRIENT_FORMS = ['granulado', 'liquido', 'foliar', 'fertirrigacao'] as const;
export const SOLUBILITY_OPTIONS = ['alta', 'media', 'baixa', 'lenta_liberacao'] as const;

// CA11: Medicamentos veterinários
export const THERAPEUTIC_CLASSES = [
  'antibiotico',
  'anti_inflamatorio',
  'antiparasitario',
  'hormonio',
  'vacina',
  'vitamina',
  'mineral',
  'anestesico',
  'outro',
] as const;
export const ADMINISTRATION_ROUTES = [
  'IM',
  'SC',
  'IV',
  'oral',
  'intramamaria',
  'intravaginal',
  'topica',
  'outro',
] as const;
export const STORAGE_CONDITIONS = ['ambiente', 'refrigerado_2_8', 'congelado'] as const;

// ─── Input Types ────────────────────────────────────────────────────

export interface CompositionInput {
  activeIngredient: string;
  concentration?: string | null;
  function?: string | null;
}

export interface CreateProductInput {
  nature: string;
  name: string;
  type: string;
  category?: string | null;
  status?: string;
  notes?: string | null;
  // Classe de Produto
  productClassId?: string | null;
  // Campos de produto (CA5)
  commercialName?: string | null;
  manufacturerName?: string | null; // cria/vincula fabricante por nome
  manufacturerCnpj?: string | null;
  measurementUnitId?: string | null;
  barcode?: string | null;
  photoUrl?: string | null;
  technicalSheetUrl?: string | null;
  // Campos de serviço (CA6)
  chargeUnit?: string | null;
  unitCost?: number | null;
  typicalFrequency?: string | null;
  requiresScheduling?: boolean;
  linkedActivity?: string | null;
  // Composição (CA7)
  compositions?: CompositionInput[];
  // CA8: Defensivos
  toxicityClass?: string | null;
  mapaRegistration?: string | null;
  environmentalClass?: string | null;
  actionMode?: string | null;
  chemicalGroup?: string | null;
  withdrawalPeriods?: WithdrawalPeriodInput[] | null;
  // CA9: Fertilizantes
  npkFormulation?: string | null;
  nutrientForm?: string | null;
  solubility?: string | null;
  nutrientComposition?: Record<string, number> | null;
  // CA10: Foliares
  nutritionalComposition?: Record<string, number> | null;
  sprayCompatibility?: SprayCompatibilityInput | null;
  // CA11: Medicamentos veterinários
  therapeuticClass?: string | null;
  administrationRoute?: string | null;
  milkWithdrawalHours?: number | null;
  slaughterWithdrawalDays?: number | null;
  vetMapaRegistration?: string | null;
  requiresPrescription?: boolean;
  storageCondition?: string | null;
  // CA12: Sementes
  cultivarId?: string | null;
  sieveSize?: string | null;
  industrialTreatment?: string | null;
  germinationPct?: number | null;
  purityPct?: number | null;
  // US-092 CA1/CA2: Alertas de estoque
  reorderPoint?: number | null;
  safetyStock?: number | null;
  expiryAlertDays?: number | null;
}

export interface WithdrawalPeriodInput {
  crop: string;
  days: number;
}

export interface SprayCompatibilityInput {
  compatible?: string[];
  incompatible?: string[];
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface ListProductsQuery {
  page?: number;
  limit?: number;
  nature?: string;
  type?: string;
  status?: string;
  category?: string;
  search?: string;
  manufacturerId?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface CompositionItem {
  id: string;
  activeIngredient: string;
  concentration: string | null;
  function: string | null;
}

export interface ManufacturerItem {
  id: string;
  name: string;
  cnpj: string | null;
}

export interface ProductItem {
  id: string;
  organizationId: string;
  nature: string;
  name: string;
  type: string;
  category: string | null;
  status: string;
  notes: string | null;
  // Classe de Produto
  productClassId: string | null;
  productClassName: string | null;
  // Produto
  commercialName: string | null;
  manufacturer: ManufacturerItem | null;
  measurementUnitId: string | null;
  measurementUnitAbbreviation: string | null;
  barcode: string | null;
  photoUrl: string | null;
  technicalSheetUrl: string | null;
  // Serviço
  chargeUnit: string | null;
  unitCost: number | null;
  typicalFrequency: string | null;
  requiresScheduling: boolean;
  linkedActivity: string | null;
  // Composição
  compositions: CompositionItem[];
  // CA8: Defensivos
  toxicityClass: string | null;
  mapaRegistration: string | null;
  environmentalClass: string | null;
  actionMode: string | null;
  chemicalGroup: string | null;
  withdrawalPeriods: WithdrawalPeriodInput[] | null;
  // CA9: Fertilizantes
  npkFormulation: string | null;
  nutrientForm: string | null;
  solubility: string | null;
  nutrientComposition: Record<string, number> | null;
  // CA10: Foliares
  nutritionalComposition: Record<string, number> | null;
  sprayCompatibility: SprayCompatibilityInput | null;
  // CA11: Medicamentos veterinários
  therapeuticClass: string | null;
  administrationRoute: string | null;
  milkWithdrawalHours: number | null;
  slaughterWithdrawalDays: number | null;
  vetMapaRegistration: string | null;
  requiresPrescription: boolean;
  storageCondition: string | null;
  // CA12: Sementes
  cultivarId: string | null;
  cultivarName: string | null;
  sieveSize: string | null;
  industrialTreatment: string | null;
  germinationPct: number | null;
  purityPct: number | null;
  // US-092 CA1/CA2: Alertas de estoque
  reorderPoint: number | null;
  safetyStock: number | null;
  expiryAlertDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListProductsResult {
  data: ProductItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
