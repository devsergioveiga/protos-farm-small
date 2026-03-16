import type { PayableCategory, PayableStatus, RecurrenceFrequency } from '@prisma/client';

// ─── Error ───────────────────────────────────────────────────────────

export class PayableError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'PayableError';
  }
}

// ─── Category Labels ─────────────────────────────────────────────────

export const PAYABLE_CATEGORY_LABELS: Record<PayableCategory, string> = {
  INPUTS: 'Insumos',
  MAINTENANCE: 'Manutenção',
  PAYROLL: 'Folha de Pagamento',
  RENT: 'Aluguel/Arrendamento',
  SERVICES: 'Serviços',
  TAXES: 'Impostos e Taxas',
  FINANCING: 'Financiamento',
  OTHER: 'Outros',
};

// ─── Input types ─────────────────────────────────────────────────────

export interface CostCenterItemInput {
  costCenterId: string;
  farmId: string;
  allocMode: 'PERCENTAGE' | 'FIXED_VALUE';
  percentage?: number;
  fixedAmount?: number;
}

export interface CreatePayableInput {
  farmId: string;
  producerId?: string;
  supplierName: string;
  category: PayableCategory;
  description: string;
  totalAmount: number;
  dueDate: string; // ISO date string
  documentNumber?: string;
  installmentCount?: number;
  costCenterItems: CostCenterItemInput[];
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  bankAccountId?: string;
  notes?: string;
}

export interface UpdatePayableInput {
  supplierName?: string;
  category?: PayableCategory;
  description?: string;
  totalAmount?: number;
  dueDate?: string;
  documentNumber?: string;
  installmentCount?: number;
  costCenterItems?: CostCenterItemInput[];
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  bankAccountId?: string;
  notes?: string;
}

export interface SettlePaymentInput {
  paidAt: string; // ISO date string
  amount: number;
  bankAccountId: string;
  interestAmount?: number;
  fineAmount?: number;
  discountAmount?: number;
}

export interface BatchSettleItem {
  payableId: string;
  amount: number;
  interestAmount?: number;
  fineAmount?: number;
  discountAmount?: number;
}

export interface BatchSettleInput {
  bankAccountId: string;
  paidAt: string; // ISO date string
  items: BatchSettleItem[];
}

export interface ListPayablesQuery {
  farmId?: string;
  status?: PayableStatus;
  category?: PayableCategory;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Output types ─────────────────────────────────────────────────────

export interface PayableInstallmentOutput {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
  amountPaid: number | null;
}

export interface PayableCostCenterItemOutput {
  id: string;
  costCenterId: string;
  farmId: string;
  allocMode: string;
  percentage: number | null;
  fixedAmount: number | null;
}

export interface PayableOutput {
  id: string;
  organizationId: string;
  farmId: string;
  producerId: string | null;
  supplierName: string;
  category: string;
  categoryLabel: string;
  description: string;
  totalAmount: number;
  dueDate: string;
  status: string;
  documentNumber: string | null;
  installmentCount: number;
  paidAt: string | null;
  amountPaid: number | null;
  bankAccountId: string | null;
  interestAmount: number | null;
  fineAmount: number | null;
  discountAmount: number | null;
  recurrenceFrequency: string | null;
  recurrenceEndDate: string | null;
  recurrenceParentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  installments: PayableInstallmentOutput[];
  costCenterItems: PayableCostCenterItemOutput[];
}

export interface PaginatedPayablesOutput {
  data: PayableOutput[];
  total: number;
  page: number;
  limit: number;
}
