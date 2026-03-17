import { SUPPLIER_CATEGORIES } from '../suppliers/suppliers.types';

// ─── RC Types ────────────────────────────────────────────────────────

// RC types reuse supplier categories (locked decision from CONTEXT.md)
export const RC_TYPES = SUPPLIER_CATEGORIES;
export type RcType = (typeof RC_TYPES)[number];

export const RC_URGENCY_LEVELS = ['NORMAL', 'URGENTE', 'EMERGENCIAL'] as const;
export type RcUrgency = (typeof RC_URGENCY_LEVELS)[number];

export const RC_STATUSES = [
  'RASCUNHO',
  'PENDENTE',
  'APROVADA',
  'REJEITADA',
  'DEVOLVIDA',
  'CANCELADA',
] as const;
export type RcStatus = (typeof RC_STATUSES)[number];

// ─── State Machine ───────────────────────────────────────────────────

export const RC_VALID_TRANSITIONS: Record<string, string[]> = {
  RASCUNHO: ['PENDENTE'],
  PENDENTE: ['APROVADA', 'REJEITADA', 'DEVOLVIDA'],
  DEVOLVIDA: ['PENDENTE'],
  APROVADA: ['CANCELADA'],
  REJEITADA: [],
  CANCELADA: [],
};

export function canTransition(from: string, to: string): boolean {
  return RC_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── SLA ─────────────────────────────────────────────────────────────

// SLA deadlines in hours (null = no SLA)
export const SLA_HOURS: Record<string, number | null> = {
  NORMAL: null,
  URGENTE: 24,
  EMERGENCIAL: 4,
};

// ─── Error ───────────────────────────────────────────────────────────

export class PurchaseRequestError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PurchaseRequestError';
  }
}

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreatePurchaseRequestItemInput {
  productId?: string;
  productName: string;
  quantity: number;
  unitId?: string;
  unitName: string;
  estimatedUnitPrice?: number;
  notes?: string;
}

export interface CreatePurchaseRequestInput {
  requestType: RcType;
  farmId: string;
  urgency: RcUrgency;
  justification?: string;
  costCenterId?: string;
  neededBy?: string; // ISO date
  geolat?: number;
  geolon?: number;
  photoUrl?: string;
  items: CreatePurchaseRequestItemInput[];
}

export interface UpdatePurchaseRequestInput {
  requestType?: RcType;
  farmId?: string;
  urgency?: RcUrgency;
  justification?: string;
  costCenterId?: string | null;
  neededBy?: string | null;
  items?: CreatePurchaseRequestItemInput[];
}

export interface ListPurchaseRequestsQuery {
  page?: number;
  limit?: number;
  status?: RcStatus;
  search?: string;
  farmId?: string;
  urgency?: RcUrgency;
  createdBy?: string;
}

export interface TransitionInput {
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'CANCEL';
  comment?: string;
}
