export interface StepProductItem {
  id: string;
  productId: string | null;
  productName: string;
  dose: number;
  doseUnit: string;
  administrationRoute: string | null;
  notes: string | null;
}

export interface StepItem {
  id: string;
  dayNumber: number;
  description: string;
  isAiDay: boolean;
  sortOrder: number;
  products: StepProductItem[];
}

export interface IatfProtocolItem {
  id: string;
  name: string;
  description: string | null;
  targetCategory: string;
  targetCategoryLabel: string;
  veterinaryAuthor: string | null;
  status: string;
  statusLabel: string;
  version: number;
  parentId: string | null;
  estimatedCostCents: number;
  stepCount: number;
  aiDayCount: number;
  notes: string | null;
  createdAt: string;
}

export interface IatfProtocolDetail extends IatfProtocolItem {
  steps: StepItem[];
}

export interface IatfProtocolsResponse {
  data: IatfProtocolItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type IatfProtocolDetailResponse = IatfProtocolDetail;

export interface VersionHistoryItem {
  id: string;
  name: string;
  version: number;
  status: string;
  statusLabel: string;
  createdAt: string;
}

export interface CostBreakdown {
  totalCostCents: number;
  steps: {
    dayNumber: number;
    description: string;
    products: {
      productName: string;
      dose: number;
      doseUnit: string;
      unitCostCents: number;
      totalCostCents: number;
    }[];
  }[];
}

export interface StepProductInput {
  productId?: string | null;
  productName: string;
  dose: number;
  doseUnit: string;
  administrationRoute?: string | null;
  notes?: string | null;
}

export interface StepInput {
  dayNumber: number;
  description: string;
  isAiDay: boolean;
  sortOrder: number;
  products: StepProductInput[];
}

export interface CreateIatfProtocolInput {
  name: string;
  description?: string | null;
  targetCategory: string;
  veterinaryAuthor?: string | null;
  status?: string;
  notes?: string | null;
  steps: StepInput[];
}

export const TARGET_CATEGORIES = [
  { value: 'COWS', label: 'Vacas' },
  { value: 'HEIFERS', label: 'Novilhas' },
  { value: 'BOTH', label: 'Ambas' },
] as const;

export const IATF_PROTOCOL_STATUSES = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'INACTIVE', label: 'Inativo' },
] as const;

export const DOSE_UNITS = [
  { value: 'mg', label: 'mg' },
  { value: 'mL', label: 'mL' },
  { value: 'UI', label: 'UI' },
  { value: 'unit', label: 'unidade' },
] as const;

export const ADMINISTRATION_ROUTES_IATF = [
  { value: 'IM', label: 'Intramuscular' },
  { value: 'SC', label: 'Subcutâneo' },
  { value: 'IV', label: 'Intravenoso' },
  { value: 'INTRAVAGINAL', label: 'Intravaginal' },
  { value: 'TOPICAL', label: 'Tópica' },
] as const;
