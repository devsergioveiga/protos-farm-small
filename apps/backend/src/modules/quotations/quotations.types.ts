export const SC_STATUSES = [
  'RASCUNHO',
  'AGUARDANDO_PROPOSTA',
  'EM_ANALISE',
  'APROVADA',
  'CANCELADA',
  'FECHADA',
] as const;
export type ScStatus = (typeof SC_STATUSES)[number];

export const SC_VALID_TRANSITIONS: Record<string, string[]> = {
  RASCUNHO: ['AGUARDANDO_PROPOSTA'],
  AGUARDANDO_PROPOSTA: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['APROVADA', 'CANCELADA'],
  APROVADA: ['FECHADA'],
  CANCELADA: [],
  FECHADA: [],
};

export function canScTransition(from: string, to: string): boolean {
  return SC_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class QuotationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'QuotationError';
  }
}

export interface CreateQuotationInput {
  purchaseRequestId: string;
  supplierIds: string[]; // at least 1
  responseDeadline?: string; // ISO date
  notes?: string;
}

export interface RegisterProposalInput {
  items: {
    purchaseRequestItemId: string;
    unitPrice: number;
    quantity: number;
    notes?: string;
  }[];
  freightTotal?: number;
  taxTotal?: number;
  paymentTerms?: string;
  validUntil?: string; // ISO date
  deliveryDays?: number;
  notes?: string;
}

export interface ApproveQuotationInput {
  selectedItems: {
    purchaseRequestItemId: string;
    quotationSupplierId: string;
  }[];
  justification?: string; // REQUIRED when selected supplier is not lowest price for any item
}

export interface ListQuotationsQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  purchaseRequestId?: string;
}

// Comparative map response shape
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
