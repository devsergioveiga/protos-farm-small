import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export type TransferType = 'INTERNA' | 'TED' | 'APLICACAO' | 'RESGATE';

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  type: TransferType;
  amount: number;
  feeAmount?: number;
  description: string;
  transferDate: string;
  notes?: string;
}

export interface TransferOutput {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromAccountName: string;
  toAccountName: string;
  type: TransferType;
  amount: number;
  feeAmount: number | null;
  description: string;
  transferDate: string;
  notes: string | null;
  createdAt: string;
}

export const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  INTERNA: 'Interna',
  TED: 'TED',
  APLICACAO: 'Aplicação',
  RESGATE: 'Resgate',
};

// ─── Query ──────────────────────────────────────────────────────────

interface UseTransfersQuery {
  startDate?: string;
  endDate?: string;
  type?: string;
  accountId?: string;
}

// ─── useTransfers ────────────────────────────────────────────────

export function useTransfers(query: UseTransfersQuery = {}) {
  const [transfers, setTransfers] = useState<TransferOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate, type, accountId } = query;

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);
      if (type) qs.set('type', type);
      if (accountId) qs.set('accountId', accountId);
      const queryStr = qs.toString();
      const result = await api.get<TransferOutput[]>(
        `/org/transfers${queryStr ? `?${queryStr}` : ''}`,
      );
      setTransfers(result ?? []);
    } catch {
      setError('Não foi possível carregar as transferências.');
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, type, accountId]);

  useEffect(() => {
    void fetchTransfers();
  }, [fetchTransfers]);

  const createTransfer = useCallback(
    async (input: CreateTransferInput): Promise<void> => {
      await api.post<TransferOutput>('/org/transfers', input);
      await fetchTransfers();
    },
    [fetchTransfers],
  );

  const deleteTransfer = useCallback(
    async (id: string): Promise<void> => {
      await api.delete(`/org/transfers/${id}`);
      await fetchTransfers();
    },
    [fetchTransfers],
  );

  return { transfers, loading, error, fetchTransfers, createTransfer, deleteTransfer };
}
