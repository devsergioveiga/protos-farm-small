import type { CostCenterItemInput } from '@protos-farm/shared';

// ─── Error class ─────────────────────────────────────────────────────

export class ReceivableError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ReceivableError';
  }
}

// ─── Input types ─────────────────────────────────────────────────────

export type ReceivableCategory =
  | 'GRAIN_SALE'
  | 'CATTLE_SALE'
  | 'MILK_SALE'
  | 'LEASE'
  | 'SERVICES'
  | 'OTHER';

export type ReceivableStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'PARTIAL'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'RENEGOTIATED';

export type RecurrenceFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface CreateReceivableInput {
  farmId: string;
  producerId?: string;
  clientName: string;
  category: ReceivableCategory;
  description: string;
  totalAmount: number;
  dueDate: string; // ISO date string
  documentNumber?: string;
  nfeKey?: string; // 44 chars
  funruralRate?: number; // e.g. 0.015 = 1.5%
  installmentCount?: number; // default 1
  costCenterItems: CostCenterItemInput[];
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  bankAccountId?: string;
  notes?: string;
}

export type UpdateReceivableInput = Partial<Omit<CreateReceivableInput, 'costCenterItems'>> & {
  costCenterItems?: CostCenterItemInput[];
};

export interface SettleReceivableInput {
  receivedAt: string; // ISO date string
  amount: number;
  bankAccountId: string;
  interestAmount?: number;
  fineAmount?: number;
  discountAmount?: number;
}

export interface RenegotiateInput {
  newDueDate: string; // ISO date string
  newAmount?: number;
  notes?: string;
}

export interface ListReceivablesQuery {
  farmId?: string;
  status?: ReceivableStatus;
  category?: ReceivableCategory;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Output types ────────────────────────────────────────────────────

export interface ReceivableInstallmentOutput {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  status: ReceivableStatus;
  receivedAt: string | null;
  amountReceived: number | null;
}

export interface ReceivableCostCenterItemOutput {
  id: string;
  costCenterId: string;
  farmId: string;
  allocMode: 'PERCENTAGE' | 'FIXED_VALUE';
  percentage: number | null;
  fixedAmount: number | null;
}

export interface ReceivableOutput {
  id: string;
  organizationId: string;
  farmId: string;
  producerId: string | null;
  clientName: string;
  category: ReceivableCategory;
  description: string;
  totalAmount: number;
  dueDate: string;
  status: ReceivableStatus;
  documentNumber: string | null;
  nfeKey: string | null;
  funruralRate: number | null;
  funruralAmount: number | null;
  installmentCount: number;
  receivedAt: string | null;
  amountReceived: number | null;
  bankAccountId: string | null;
  interestAmount: number | null;
  fineAmount: number | null;
  discountAmount: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  installments: ReceivableInstallmentOutput[];
  costCenterItems: ReceivableCostCenterItemOutput[];
}

// ─── Aging types ─────────────────────────────────────────────────────

export type AgingBucket =
  | 'overdue'
  | 'due_7d'
  | 'due_15d'
  | 'due_30d'
  | 'due_60d'
  | 'due_90d'
  | 'due_over_90d';

export interface AgingBucketResult {
  bucket: AgingBucket;
  label: string;
  count: number;
  total: number;
}

export interface AgingResponse {
  buckets: AgingBucketResult[];
  grandTotal: number;
  overdueCount: number;
}
