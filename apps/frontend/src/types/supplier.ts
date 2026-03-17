export type SupplierType = 'PF' | 'PJ';
export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export type SupplierCategory =
  | 'INSUMO_AGRICOLA'
  | 'PECUARIO'
  | 'PECAS'
  | 'COMBUSTIVEL'
  | 'EPI'
  | 'SERVICOS'
  | 'OUTROS';

export const SUPPLIER_CATEGORY_LABELS: Record<SupplierCategory, string> = {
  INSUMO_AGRICOLA: 'Insumo Agricola',
  PECUARIO: 'Pecuario',
  PECAS: 'Pecas',
  COMBUSTIVEL: 'Combustivel',
  EPI: 'EPI',
  SERVICOS: 'Servicos',
  OUTROS: 'Outros',
};

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  BLOCKED: 'Bloqueado',
};

export const PAYMENT_TERMS_SUGGESTIONS = [
  'A vista',
  '7 dias',
  '15 dias',
  '30 dias',
  '30/60/90',
  '28/56/84',
];

export interface Supplier {
  id: string;
  type: SupplierType;
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
  status: SupplierStatus;
  categories: SupplierCategory[];
  averageRating?: number;
  ratingCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierRating {
  id: string;
  deadline: number;
  quality: number;
  price: number;
  service: number;
  comment?: string;
  ratedBy: string;
  createdAt: string;
  average: number;
}

export interface CreateSupplierInput {
  type: SupplierType;
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
  status?: SupplierStatus;
  categories: SupplierCategory[];
}

export interface SuppliersListResponse {
  data: Supplier[];
  total: number;
  page: number;
  limit: number;
}
