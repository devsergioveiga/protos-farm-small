export type QuotationStatus =
  | 'RASCUNHO'
  | 'AGUARDANDO_PROPOSTA'
  | 'EM_ANALISE'
  | 'APROVADA'
  | 'CANCELADA'
  | 'FECHADA';

export interface QuotationRcItem {
  id: string;
  productId: string | null;
  productName: string;
  unitName: string;
  quantity: number;
  description: string | null;
}

export interface QuotationProposalItem {
  id: string;
  purchaseRequestItemId: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  notes: string | null;
}

export interface QuotationProposal {
  id: string;
  freightTotal: number | null;
  taxTotal: number | null;
  paymentTerms: string | null;
  validUntil: string | null;
  deliveryDays: number | null;
  fileUrl: string | null;
  fileName: string | null;
  notes: string | null;
  items: QuotationProposalItem[];
}

export interface QuotationSupplierData {
  id: string; // quotationSupplierId
  supplierId: string;
  isSelected: boolean;
  supplier: { id: string; name: string; tradeName: string | null; status: string };
  proposal: QuotationProposal | null;
}

export interface QuotationItemSelection {
  id: string;
  purchaseRequestItemId: string;
  quotationSupplierId: string;
}

export interface Quotation {
  id: string;
  sequentialNumber: string;
  status: QuotationStatus;
  responseDeadline: string | null;
  notes: string | null;
  approvedBy: string | null;
  approvalJustification: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  purchaseRequest: {
    id: string;
    sequentialNumber: string;
    type: string;
    urgency: string;
    items: QuotationRcItem[];
  };
  suppliers: QuotationSupplierData[];
  itemSelections?: QuotationItemSelection[];
}

export interface ComparativeMapData {
  items: {
    purchaseRequestItemId: string;
    productName: string;
    unitName: string;
    quantity: number;
    lastPricePaid: number | null;
  }[];
  suppliers: {
    supplierId: string;
    supplierName: string;
    rating: number | null;
    quotationSupplierId: string;
    proposalId: string | null;
    freightTotal: number | null;
    taxTotal: number | null;
    deliveryDays: number | null;
    paymentTerms: string | null;
    validUntil: string | null;
    proposalItems: {
      purchaseRequestItemId: string;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
      notes: string | null;
    }[];
  }[];
  perItemMinPrice: Record<string, number | null>;
  perItemMaxPrice: Record<string, number | null>;
}

export const SC_STATUS_LABELS: Record<QuotationStatus, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_PROPOSTA: 'Aguardando Proposta',
  EM_ANALISE: 'Em Analise',
  APROVADA: 'Aprovada',
  CANCELADA: 'Cancelada',
  FECHADA: 'Fechada',
};

export const SC_STATUS_COLORS: Record<QuotationStatus, string> = {
  RASCUNHO: 'sc-badge--rascunho',
  AGUARDANDO_PROPOSTA: 'sc-badge--aguardando',
  EM_ANALISE: 'sc-badge--analise',
  APROVADA: 'sc-badge--aprovada',
  CANCELADA: 'sc-badge--cancelada',
  FECHADA: 'sc-badge--fechada',
};

export interface QuotationListResponse {
  data: Quotation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateQuotationInput {
  purchaseRequestId: string;
  supplierIds: string[];
  responseDeadline?: string;
  notes?: string;
}

export interface RegisterProposalInput {
  items: { purchaseRequestItemId: string; unitPrice: number; quantity: number }[];
  freightTotal?: number;
  taxTotal?: number;
  paymentTerms?: string;
  validUntil?: string;
  deliveryDays?: number;
  notes?: string;
}

export interface ApproveQuotationInput {
  selectedItems: { purchaseRequestItemId: string; quotationSupplierId: string }[];
  justification?: string;
}
