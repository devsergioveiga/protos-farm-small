import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export type CreditCardBrand = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD' | 'OTHER';
export type BillStatus = 'OPEN' | 'CLOSED';

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
  status: BillStatus;
  payableId: string | null;
  expenses: ExpenseOutput[];
  closedAt: string | null;
}

export interface CreditCardOutput {
  id: string;
  name: string;
  brand: CreditCardBrand;
  lastFourDigits: string | null;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  debitAccountId: string;
  debitAccountName: string;
  farmId: string;
  farmName: string;
  holder: string;
  notes: string | null;
  isActive: boolean;
  currentBill: BillOutput | null;
  createdAt: string;
}

export interface CreditCardWithBills extends CreditCardOutput {
  bills: BillOutput[];
}

export interface CreateCreditCardInput {
  name: string;
  brand: CreditCardBrand;
  lastFourDigits?: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  debitAccountId: string;
  farmId: string;
  holder: string;
  notes?: string;
}

export interface AddExpenseInput {
  description: string;
  amount: number;
  totalInstallments: number;
  expenseDate: string;
  category?: string;
  notes?: string;
}

export interface CloseBillResult {
  bill: BillOutput;
  payableId: string;
}

// ─── useCreditCards ─────────────────────────────────────────────────

export function useCreditCards() {
  const [cards, setCards] = useState<CreditCardOutput[]>([]);
  const [selectedCard, setSelectedCard] = useState<CreditCardWithBills | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Fetch list ──────────────────────────────────────────────────

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<CreditCardOutput[]>('/org/credit-cards');
      setCards(result ?? []);
    } catch {
      setError('Não foi possível carregar os cartões. Verifique sua conexão e tente novamente.');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  // ── Fetch card detail with bills ────────────────────────────────

  const fetchCard = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const [card, billsResult] = await Promise.all([
        api.get<CreditCardOutput>(`/org/credit-cards/${id}`),
        api.get<BillOutput[]>(`/org/credit-cards/${id}/bills`),
      ]);
      const cardWithBills: CreditCardWithBills = {
        ...card,
        bills: billsResult ?? [],
      };
      setSelectedCard(cardWithBills);
      return cardWithBills;
    } catch {
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── CRUD ────────────────────────────────────────────────────────

  const createCard = useCallback(async (input: CreateCreditCardInput) => {
    return api.post<CreditCardOutput>('/org/credit-cards', input);
  }, []);

  const updateCard = useCallback(async (id: string, input: Partial<CreateCreditCardInput>) => {
    return api.put<CreditCardOutput>(`/org/credit-cards/${id}`, input);
  }, []);

  const deleteCard = useCallback(async (id: string) => {
    return api.delete<{ message: string }>(`/org/credit-cards/${id}`);
  }, []);

  // ── Expenses ────────────────────────────────────────────────────

  const addExpense = useCallback(async (cardId: string, input: AddExpenseInput) => {
    return api.post<ExpenseOutput>(`/org/credit-cards/${cardId}/expenses`, input);
  }, []);

  // ── Bills ───────────────────────────────────────────────────────

  const fetchBills = useCallback(async (cardId: string) => {
    return api.get<BillOutput[]>(`/org/credit-cards/${cardId}/bills`);
  }, []);

  const closeBill = useCallback(async (billId: string) => {
    return api.post<CloseBillResult>(`/org/credit-cards/bills/${billId}/close`);
  }, []);

  return {
    cards,
    selectedCard,
    setSelectedCard,
    loading,
    error,
    detailLoading,
    fetchCards,
    fetchCard,
    createCard,
    updateCard,
    deleteCard,
    addExpense,
    fetchBills,
    closeBill,
  };
}
