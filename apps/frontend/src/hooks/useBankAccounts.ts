import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export interface BankAccountBalance {
  initialBalance: number;
  currentBalance: number;
}

export interface BankAccountFarm {
  id: string;
  name: string;
}

export interface BankAccountProducer {
  id: string;
  name: string;
}

export type BankAccountType = 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'RURAL_CREDIT';

export interface BankAccount {
  id: string;
  name: string;
  type: BankAccountType;
  bankCode: string;
  bankName: string;
  agency: string;
  agencyDigit?: string;
  accountNumber: string;
  accountDigit?: string;
  producerId?: string;
  producer?: BankAccountProducer;
  farms: BankAccountFarm[];
  balance: BankAccountBalance;
  notes?: string;
  isActive: boolean;
}

export interface BankAccountDashboardByType {
  type: BankAccountType;
  count: number;
  totalBalance: number;
}

export interface BankAccountDashboard {
  totalBalance: number;
  accountCount: number;
  byType: BankAccountDashboardByType[];
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  type: 'CREDIT' | 'DEBIT' | 'OPENING_BALANCE';
  amount: number;
  balance: number;
  referenceId?: string;
  referenceType?: string;
}

interface BankAccountsResponse {
  data: BankAccount[];
}

interface BankAccountStatementResponse {
  data: BankTransaction[];
}

// ─── useBankAccounts ─────────────────────────────────────────────────

interface UseBankAccountsFilters {
  farmId?: string;
  type?: string;
  bankCode?: string;
}

export function useBankAccounts(filters: UseBankAccountsFilters = {}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, type, bankCode } = filters;

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (farmId) qs.set('farmId', farmId);
      if (type) qs.set('type', type);
      if (bankCode) qs.set('bankCode', bankCode);
      const query = qs.toString();
      const result = await api.get<BankAccountsResponse>(
        `/org/bank-accounts${query ? `?${query}` : ''}`,
      );
      setAccounts(result.data);
    } catch {
      setError('Não foi possível carregar as contas bancárias.');
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, type, bankCode]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  return { accounts, isLoading, error, refetch: fetchAccounts };
}

// ─── useBankAccountDashboard ──────────────────────────────────────────

export function useBankAccountDashboard() {
  const [dashboard, setDashboard] = useState<BankAccountDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<BankAccountDashboard>('/org/bank-accounts/dashboard');
      setDashboard(result);
    } catch {
      setError('Não foi possível carregar o resumo financeiro.');
      setDashboard(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { dashboard, isLoading, error, refetch: fetchDashboard };
}

// ─── useBankAccountStatement ──────────────────────────────────────────

interface UseBankAccountStatementQuery {
  from?: string;
  to?: string;
  type?: string;
}

export function useBankAccountStatement(
  accountId: string | null,
  query: UseBankAccountStatementQuery = {},
) {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { from, to, type } = query;

  const fetchStatement = useCallback(async () => {
    if (!accountId) return;
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (type) qs.set('type', type);
      const queryStr = qs.toString();
      const result = await api.get<BankAccountStatementResponse>(
        `/org/bank-accounts/${accountId}/statement${queryStr ? `?${queryStr}` : ''}`,
      );
      setTransactions(result.data);
    } catch {
      setError('Não foi possível carregar o extrato.');
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, from, to, type]);

  useEffect(() => {
    void fetchStatement();
  }, [fetchStatement]);

  return { transactions, isLoading, error, refetch: fetchStatement };
}
