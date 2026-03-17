import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export type LineStatus = 'PENDING' | 'RECONCILED' | 'IGNORED';
export type ConfidenceLevel = 'EXATO' | 'PROVAVEL' | 'SEM_MATCH';
export type LineType = 'CREDIT' | 'DEBIT';
export type ImportStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type CandidateType = 'PAYABLE' | 'RECEIVABLE' | 'TRANSFER';

export interface MatchCandidate {
  id: string;
  type: CandidateType;
  description: string;
  date: string;
  amount: number;
  status: string;
  score: number;
  confidence: ConfidenceLevel;
}

export interface StatementLineWithMatches {
  id: string;
  importId: string;
  date: string;
  amount: number;
  memo: string;
  type: LineType;
  status: LineStatus;
  fitId?: string;
  lineHash: string;
  topMatch?: MatchCandidate;
  allMatches: MatchCandidate[];
}

export interface BankStatementImport {
  id: string;
  fileName: string;
  fileType: 'OFX' | 'CSV';
  bankAccountId: string;
  bankAccountName?: string;
  importedById: string;
  importedByName?: string;
  totalLines: number;
  importedLines: number;
  pendingLines: number;
  reconciledLines: number;
  ignoredLines: number;
  duplicatesSkipped: number;
  status: ImportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ImportHistoryResponse {
  imports: BankStatementImport[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ImportPreviewResponse {
  fileType: 'OFX' | 'CSV';
  bankAccountName?: string;
  bankAccountId?: string;
  suggestedMapping?: {
    date?: string;
    amount?: string;
    description?: string;
    type?: string;
  };
  headers?: string[];
  lines: Array<{
    index: number;
    date: string;
    amount: number;
    description: string;
    type: LineType;
    raw?: Record<string, string>;
  }>;
  totalLines: number;
}

export interface ImportResult {
  importId: string;
  importedLines: number;
  duplicatesSkipped: number;
}

export interface ManualLinkItem {
  id: string;
  type: CandidateType;
}

// ─── Auth helper ──────────────────────────────────────────────────

function getAuthToken(): string {
  return (
    localStorage.getItem('protos_access_token') ??
    localStorage.getItem('authToken') ??
    sessionStorage.getItem('authToken') ??
    ''
  );
}

// ─── useImportHistory ─────────────────────────────────────────────

interface UseImportHistoryQuery {
  bankAccountId?: string;
  page?: number;
  limit?: number;
}

export function useImportHistory(query: UseImportHistoryQuery = {}) {
  const [imports, setImports] = useState<BankStatementImport[]>([]);
  const [meta, setMeta] = useState<ImportHistoryResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { bankAccountId, page = 1, limit = 20 } = query;

  const fetchImports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (bankAccountId) qs.set('bankAccountId', bankAccountId);
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      const result = await api.get<ImportHistoryResponse>(
        `/org/reconciliation/imports?${qs.toString()}`,
      );
      setImports(result?.imports ?? []);
      setMeta(result?.meta ?? null);
    } catch {
      setError('Não foi possível carregar o histórico de importações.');
      setImports([]);
    } finally {
      setLoading(false);
    }
  }, [bankAccountId, page, limit]);

  useEffect(() => {
    void fetchImports();
  }, [fetchImports]);

  return { imports, meta, loading, error, refetch: fetchImports };
}

// ─── useImportLines ───────────────────────────────────────────────

export function useImportLines(importId: string | null) {
  const [lines, setLines] = useState<StatementLineWithMatches[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLines = useCallback(async () => {
    if (!importId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ lines: StatementLineWithMatches[] }>(
        `/org/reconciliation/imports/${importId}/lines`,
      );
      setLines(result?.lines ?? []);
    } catch {
      setError('Não foi possível carregar as linhas do extrato.');
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [importId]);

  useEffect(() => {
    void fetchLines();
  }, [fetchLines]);

  return { lines, loading, error, refetch: fetchLines };
}

// ─── useReconciliationActions ─────────────────────────────────────

export function useReconciliationActions() {
  const uploadPreview = useCallback(async (file: File): Promise<ImportPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getAuthToken();
    const response = await fetch('/api/org/reconciliation/preview', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new Error(err.message ?? err.error ?? 'Não foi possível processar o arquivo.');
    }
    return response.json() as Promise<ImportPreviewResponse>;
  }, []);

  const confirmImport = useCallback(
    async (
      file: File,
      bankAccountId: string,
      selectedLineIndices?: number[],
      columnMapping?: Record<string, string>,
    ): Promise<ImportResult> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bankAccountId', bankAccountId);
      if (selectedLineIndices !== undefined) {
        formData.append('selectedLineIndices', JSON.stringify(selectedLineIndices));
      }
      if (columnMapping) {
        formData.append('columnMapping', JSON.stringify(columnMapping));
      }
      const token = getAuthToken();
      const response = await fetch('/api/org/reconciliation/imports', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(err.message ?? err.error ?? 'Não foi possível importar o arquivo.');
      }
      return response.json() as Promise<ImportResult>;
    },
    [],
  );

  const acceptMatch = useCallback(
    async (importId: string, lineId: string, reconciliationId: string): Promise<void> => {
      await api.post(`/org/reconciliation/imports/${importId}/lines/${lineId}/confirm`, {
        reconciliationId,
      });
    },
    [],
  );

  const rejectMatch = useCallback(
    async (importId: string, lineId: string, reconciliationId: string): Promise<void> => {
      await api.post(`/org/reconciliation/imports/${importId}/lines/${lineId}/reject`, {
        reconciliationId,
      });
    },
    [],
  );

  const manualLink = useCallback(
    async (importId: string, lineId: string, links: ManualLinkItem[]): Promise<void> => {
      await api.post(`/org/reconciliation/imports/${importId}/lines/${lineId}/link`, { links });
    },
    [],
  );

  const ignoreLine = useCallback(async (importId: string, lineId: string): Promise<void> => {
    await api.post(`/org/reconciliation/imports/${importId}/lines/${lineId}/ignore`, {});
  }, []);

  const searchCandidates = useCallback(
    async (importId: string, search: string, bankAccountId: string): Promise<MatchCandidate[]> => {
      const qs = new URLSearchParams({ search, bankAccountId });
      const result = await api.get<{ candidates: MatchCandidate[] }>(
        `/org/reconciliation/imports/${importId}/search?${qs.toString()}`,
      );
      return result?.candidates ?? [];
    },
    [],
  );

  return {
    uploadPreview,
    confirmImport,
    acceptMatch,
    rejectMatch,
    manualLink,
    ignoreLine,
    searchCandidates,
  };
}
