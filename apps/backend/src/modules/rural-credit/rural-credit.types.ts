// ─── Error ───────────────────────────────────────────────────────────

export class RuralCreditError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'RuralCreditError';
  }
}

// ─── Credit Line Labels ───────────────────────────────────────────────

export const CREDIT_LINE_LABELS: Record<string, string> = {
  PRONAF: 'PRONAF',
  PRONAMP: 'PRONAMP',
  FUNCAFE: 'Funcafe',
  CPR: 'CPR',
  CREDITO_LIVRE: 'Credito Livre',
};

// ─── Input Types ──────────────────────────────────────────────────────

export interface CreateContractInput {
  farmId: string;
  bankAccountId: string;
  contractNumber?: string;
  creditLine: 'PRONAF' | 'PRONAMP' | 'FUNCAFE' | 'CPR' | 'CREDITO_LIVRE';
  amortizationSystem: 'SAC' | 'PRICE' | 'BULLET';
  principalAmount: number;
  annualRate: number; // e.g. 0.065 for 6.5%
  termMonths: number;
  gracePeriodMonths?: number; // default 0
  firstPaymentYear: number;
  firstPaymentMonth: number; // 1-12
  paymentDayOfMonth?: number; // default 1
  releasedAt: string; // ISO date
  iofAmount?: number;
  tacAmount?: number;
  guaranteeDescription?: string;
  alertDaysBefore?: number; // default 15
  notes?: string;
}

export type SimulateInput = Pick<
  CreateContractInput,
  | 'farmId'
  | 'bankAccountId'
  | 'creditLine'
  | 'amortizationSystem'
  | 'principalAmount'
  | 'annualRate'
  | 'termMonths'
  | 'gracePeriodMonths'
  | 'firstPaymentYear'
  | 'firstPaymentMonth'
  | 'paymentDayOfMonth'
>;

export interface UpdateContractInput {
  contractNumber?: string;
  alertDaysBefore?: number;
  guaranteeDescription?: string;
  notes?: string;
  // Schedule recalculation fields (triggers installment regeneration):
  annualRate?: number;
  termMonths?: number;
  firstPaymentYear?: number;
  firstPaymentMonth?: number;
  paymentDayOfMonth?: number;
}

export interface ExtraordinaryAmortizationInput {
  extraAmount: number;
  recalculateMode: 'REDUCE_TERM' | 'REDUCE_INSTALLMENT';
  paidAt: string; // ISO date
}

export interface SettleInstallmentInput {
  paidAmount: number;
  paidAt: string; // ISO date
  juros?: number;
  multa?: number;
  desconto?: number;
}

export interface ListContractsQuery {
  farmId?: string;
  status?: string;
  creditLine?: string;
  page?: number;
  limit?: number;
}

// ─── Output Types ─────────────────────────────────────────────────────

export interface RuralCreditInstallmentOutput {
  id: string;
  contractId: string;
  payableId: string;
  installmentNumber: number;
  principal: number;
  interest: number;
  outstandingBalanceAfter: number;
  // From joined Payable
  payableStatus: string;
  dueDate: string;
  totalPayment: number;
  paidAt: string | null;
  amountPaid: number | null;
}

export interface ContractOutput {
  id: string;
  organizationId: string;
  farmId: string;
  bankAccountId: string;
  contractNumber: string | null;
  creditLine: string;
  creditLineLabel: string;
  amortizationSystem: string;
  principalAmount: number;
  annualRate: number;
  termMonths: number;
  gracePeriodMonths: number;
  firstPaymentYear: number;
  firstPaymentMonth: number;
  paymentDayOfMonth: number;
  releasedAt: string;
  iofAmount: number | null;
  tacAmount: number | null;
  guaranteeDescription: string | null;
  alertDaysBefore: number;
  status: string;
  outstandingBalance: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  notes: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  installments: RuralCreditInstallmentOutput[];
  bankName?: string | null;
}

export interface ContractListItem {
  id: string;
  creditLine: string;
  creditLineLabel: string;
  contractNumber: string | null;
  bankAccountId: string;
  bankName: string | null;
  principalAmount: number;
  outstandingBalance: number;
  status: string;
  nextPaymentDate: string | null;
  nextPaymentAmount: number | null;
  createdAt: string;
}

export interface SimulateScheduleRow {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  totalPayment: number;
  outstandingBalance: number;
}
