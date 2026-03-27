import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { LedgerOutput, TrialBalanceOutput } from '@/types/journal-entries';

// ─── Daily Book Types ─────────────────────────────────────────────────────────

export interface DailyBookLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  side: 'DEBIT' | 'CREDIT';
  amount: string;
  costCenterId: string | null;
}

export interface DailyBookEntry {
  entryId: string;
  entryNumber: number;
  entryDate: string;
  description: string;
  lines: DailyBookLine[];
}

export interface DailyBookOutput {
  startDate: string;
  endDate: string;
  entries: DailyBookEntry[];
}

// ─── Ledger Filters ───────────────────────────────────────────────────────────

export interface LedgerFilters {
  accountId: string;
  startDate: string;
  endDate: string;
  costCenterId?: string;
}

export interface TrialBalanceFilters {
  fiscalYearId: string;
  month: number;
  comparePreviousPeriod?: boolean;
}

export interface DailyBookFilters {
  startDate: string;
  endDate: string;
  entryType?: string;
}

// ─── useLedger ────────────────────────────────────────────────────────────────

export function useLedger(
  orgId: string | undefined,
  accountId: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  costCenterId?: string,
) {
  const [ledger, setLedger] = useState<LedgerOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    if (!orgId || !accountId || !startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ accountId, startDate, endDate });
      if (costCenterId) params.set('costCenterId', costCenterId);
      const result = await api.get<LedgerOutput>(
        `/org/${orgId}/ledger/razao?${params.toString()}`,
      );
      setLedger(result);
    } catch {
      setError('Não foi possível carregar o razão. Tente novamente.');
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, accountId, startDate, endDate, costCenterId]);

  useEffect(() => {
    void fetchLedger();
  }, [fetchLedger]);

  return { ledger, loading, error, refetch: fetchLedger };
}

// ─── useTrialBalance ──────────────────────────────────────────────────────────

export function useTrialBalance(
  orgId: string | undefined,
  fiscalYearId: string | undefined,
  month: number | undefined,
  comparePreviousPeriod?: boolean,
) {
  const [trialBalance, setTrialBalance] = useState<TrialBalanceOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrialBalance = useCallback(async () => {
    if (!orgId || !fiscalYearId || month === undefined) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fiscalYearId,
        month: String(month),
      });
      if (comparePreviousPeriod) params.set('comparePreviousPeriod', 'true');
      const result = await api.get<TrialBalanceOutput>(
        `/org/${orgId}/ledger/balancete?${params.toString()}`,
      );
      setTrialBalance(result);
    } catch {
      setError('Não foi possível carregar o balancete. Tente novamente.');
      setTrialBalance(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, fiscalYearId, month, comparePreviousPeriod]);

  useEffect(() => {
    void fetchTrialBalance();
  }, [fetchTrialBalance]);

  return { trialBalance, loading, error, refetch: fetchTrialBalance };
}

// ─── useDailyBook ─────────────────────────────────────────────────────────────

export function useDailyBook(
  orgId: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  entryType?: string,
) {
  const [dailyBook, setDailyBook] = useState<DailyBookOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDailyBook = useCallback(async () => {
    if (!orgId || !startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (entryType) params.set('entryType', entryType);
      const result = await api.get<DailyBookOutput>(
        `/org/${orgId}/ledger/diario?${params.toString()}`,
      );
      setDailyBook(result);
    } catch {
      setError('Não foi possível carregar o livro diário. Tente novamente.');
      setDailyBook(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, startDate, endDate, entryType]);

  useEffect(() => {
    void fetchDailyBook();
  }, [fetchDailyBook]);

  return { dailyBook, loading, error, refetch: fetchDailyBook };
}

// ─── Export Functions ─────────────────────────────────────────────────────────

function buildDownloadUrl(base: string, path: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  return `${base}${path}?${query}`;
}

async function triggerBlobDownload(
  url: string,
  filename: string,
): Promise<void> {
  const blob = await api.getBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

export async function exportLedgerCsv(
  orgId: string,
  filters: LedgerFilters,
): Promise<void> {
  const params: Record<string, string> = {
    accountId: filters.accountId,
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
  if (filters.costCenterId) params.costCenterId = filters.costCenterId;
  const url = buildDownloadUrl('', `/org/${orgId}/ledger/razao/export/csv`, params);
  await triggerBlobDownload(url, `razao-${filters.accountId}-${filters.startDate}.csv`);
}

export async function exportLedgerPdf(
  orgId: string,
  filters: LedgerFilters,
): Promise<void> {
  const params: Record<string, string> = {
    accountId: filters.accountId,
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
  if (filters.costCenterId) params.costCenterId = filters.costCenterId;
  const url = buildDownloadUrl('', `/org/${orgId}/ledger/razao/export/pdf`, params);
  await triggerBlobDownload(url, `razao-${filters.accountId}-${filters.startDate}.pdf`);
}

export async function exportTrialBalancePdf(
  orgId: string,
  filters: TrialBalanceFilters,
): Promise<void> {
  const params: Record<string, string> = {
    fiscalYearId: filters.fiscalYearId,
    month: String(filters.month),
  };
  const url = buildDownloadUrl('', `/org/${orgId}/ledger/balancete/export/pdf`, params);
  await triggerBlobDownload(url, `balancete-${filters.fiscalYearId}-${filters.month}.pdf`);
}

export async function exportTrialBalanceXlsx(
  orgId: string,
  filters: TrialBalanceFilters,
): Promise<void> {
  const params: Record<string, string> = {
    fiscalYearId: filters.fiscalYearId,
    month: String(filters.month),
  };
  const url = buildDownloadUrl('', `/org/${orgId}/ledger/balancete/export/xlsx`, params);
  await triggerBlobDownload(url, `balancete-${filters.fiscalYearId}-${filters.month}.xlsx`);
}

export async function exportDailyBookPdf(
  orgId: string,
  filters: DailyBookFilters,
): Promise<void> {
  const params: Record<string, string> = {
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
  if (filters.entryType) params.entryType = filters.entryType;
  const url = buildDownloadUrl('', `/org/${orgId}/ledger/diario/export/pdf`, params);
  await triggerBlobDownload(url, `livro-diario-${filters.startDate}.pdf`);
}

// ─── useOrgId ─────────────────────────────────────────────────────────────────

export function useOrgId(): string | undefined {
  const { user } = useAuth();
  return user?.organizationId ?? undefined;
}
