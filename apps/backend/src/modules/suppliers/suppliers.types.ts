// ─── Error ──────────────────────────────────────────────────────────

export class SupplierError extends Error {
  public data?: Record<string, unknown>;
  constructor(
    message: string,
    public statusCode: number,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SupplierError';
    this.data = data;
  }
}

// ─── Constants ──────────────────────────────────────────────────────

export const SUPPLIER_CATEGORIES = [
  'INSUMO_AGRICOLA',
  'PECUARIO',
  'PECAS',
  'COMBUSTIVEL',
  'EPI',
  'SERVICOS',
  'OUTROS',
] as const;

export const SUPPLIER_CATEGORY_LABELS: Record<string, string> = {
  INSUMO_AGRICOLA: 'Insumo Agrícola',
  PECUARIO: 'Pecuário',
  PECAS: 'Peças',
  COMBUSTIVEL: 'Combustível',
  EPI: 'EPI',
  SERVICOS: 'Serviços',
  OUTROS: 'Outros',
};

export const SUPPLIER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;

export const PAYMENT_TERMS_SUGGESTIONS = [
  'À vista',
  '7 dias',
  '15 dias',
  '30 dias',
  '30/60/90',
  '28/56/84',
];

// ─── Input types ────────────────────────────────────────────────────

export interface CreateSupplierInput {
  type: 'PF' | 'PJ';
  name: string;
  tradeName?: string;
  document: string;
  stateRegistration?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTerms?: string;
  freightType?: 'CIF' | 'FOB';
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  categories: string[];
}

export interface UpdateSupplierInput {
  name?: string;
  tradeName?: string;
  document?: string;
  stateRegistration?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTerms?: string;
  freightType?: 'CIF' | 'FOB';
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  categories?: string[];
}

export interface ListSuppliersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category?: string;
  city?: string;
  state?: string;
}

export interface CreateRatingInput {
  deadline: number; // 1-5
  quality: number; // 1-5
  price: number; // 1-5
  service: number; // 1-5
  comment?: string;
}

export interface PerformanceHistoryPoint {
  date: string; // ISO date "YYYY-MM-DD"
  average: number; // 1-5 scale, rounded to 2 decimals
}

export interface PerformanceCriteriaBreakdown {
  deadline: number;
  quality: number;
  price: number;
  service: number;
}

export interface PerformanceReportOutput {
  history: PerformanceHistoryPoint[];
  breakdown: PerformanceCriteriaBreakdown;
  totalRatings: number;
}
