// ─── Error ───────────────────────────────────────────────────────────

export class CreditCardError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'CreditCardError';
  }
}

// ─── Enums ────────────────────────────────────────────────────────────

export type CardBrand = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD' | 'OTHER';

// ─── Input types ─────────────────────────────────────────────────────

export interface CreateCreditCardInput {
  name: string;
  brand: CardBrand;
  lastFourDigits?: string;
  creditLimit: number;
  closingDay: number; // 1-28
  dueDay: number; // 1-28
  debitAccountId: string;
  farmId: string;
  holder: string;
  notes?: string;
}

export interface UpdateCreditCardInput {
  name?: string;
  brand?: CardBrand;
  lastFourDigits?: string;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  debitAccountId?: string;
  farmId?: string;
  holder?: string;
  isActive?: boolean;
  notes?: string;
}

export interface AddExpenseInput {
  description: string;
  amount: number; // total amount (divided by installments)
  totalInstallments: number; // 1-24
  expenseDate: string; // ISO date
  category?: string;
  notes?: string;
}

// ─── Output types ────────────────────────────────────────────────────

export interface ExpenseOutput {
  id: string;
  description: string;
  amount: number;
  expenseDate: string;
  installmentNumber: number;
  totalInstallments: number;
  category: string | null;
  notes: string | null;
}

export interface BillOutput {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  totalAmount: number;
  status: string;
  payableId: string | null;
  expenses: ExpenseOutput[];
  closedAt: string | null;
}

export interface CreditCardOutput {
  id: string;
  name: string;
  brand: string;
  lastFourDigits: string | null;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  debitAccountId: string;
  debitAccountName: string;
  farmId: string;
  farmName: string;
  holder: string;
  isActive: boolean;
  notes: string | null;
  currentBill: BillOutput | null;
  createdAt: string;
}

export interface OpenBillsCountOutput {
  count: number;
}
