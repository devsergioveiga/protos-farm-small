// ─── Enums ────────────────────────────────────────────────────────

export type RuralCreditLine = 'PRONAF' | 'PRONAMP' | 'FUNCAFE' | 'CPR' | 'CREDITO_LIVRE';
export type AmortizationSystem = 'SAC' | 'PRICE' | 'BULLET';
export type RuralCreditStatus = 'ATIVO' | 'QUITADO' | 'INADIMPLENTE' | 'CANCELADO';

// ─── Interfaces ───────────────────────────────────────────────────

export interface RuralCreditContract {
  id: string;
  farmId: string;
  bankAccountId: string;
  contractNumber: string | null;
  creditLine: RuralCreditLine;
  amortizationSystem: AmortizationSystem;
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
  status: RuralCreditStatus;
  outstandingBalance: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  notes: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed in list view:
  nextPaymentDate?: string | null;
  nextPaymentAmount?: number | null;
  bankName?: string;
  farmName?: string;
  // Detail view:
  installments?: RuralCreditInstallmentDetail[];
}

export interface RuralCreditInstallmentDetail {
  id: string;
  installmentNumber: number;
  principal: number;
  interest: number;
  outstandingBalanceAfter: number;
  payableId: string;
  payableStatus: string; // PENDING | PAID | CANCELLED
  dueDate: string;
  totalAmount: number;
  paidAt?: string | null;
}

export interface ScheduleRow {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  totalPayment: number;
  outstandingBalance: number;
}

// ─── Labels ───────────────────────────────────────────────────────

export const CREDIT_LINE_LABELS: Record<RuralCreditLine, string> = {
  PRONAF: 'PRONAF',
  PRONAMP: 'PRONAMP',
  FUNCAFE: 'Funcafe',
  CPR: 'CPR',
  CREDITO_LIVRE: 'Credito Livre',
};

export const AMORTIZATION_LABELS: Record<AmortizationSystem, string> = {
  SAC: 'SAC',
  PRICE: 'Price (PMT)',
  BULLET: 'Bullet',
};

export const STATUS_LABELS: Record<RuralCreditStatus, string> = {
  ATIVO: 'Ativo',
  QUITADO: 'Quitado',
  INADIMPLENTE: 'Inadimplente',
  CANCELADO: 'Cancelado',
};
