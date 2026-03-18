// ─── Error ───────────────────────────────────────────────────────────

export class TransferError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'TransferError';
  }
}

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  type: 'INTERNA' | 'TED' | 'APLICACAO' | 'RESGATE';
  amount: number;
  feeAmount?: number;
  description: string;
  transferDate: string; // ISO date string
  notes?: string;
}

export interface ListTransfersQuery {
  startDate?: string;
  endDate?: string;
  type?: string;
  accountId?: string; // filter by either fromAccountId or toAccountId
}

// ─── Output Types ────────────────────────────────────────────────────

export interface TransferOutput {
  id: string;
  organizationId: string;
  fromAccountId: string;
  toAccountId: string;
  fromAccountName: string;
  toAccountName: string;
  type: string;
  amount: number;
  feeAmount: number | null;
  description: string;
  transferDate: string;
  notes: string | null;
  createdAt: string;
}

// ─── Labels ──────────────────────────────────────────────────────────

export const TRANSFER_TYPE_LABELS: Record<string, string> = {
  INTERNA: 'Interna',
  TED: 'TED',
  APLICACAO: 'Aplicação',
  RESGATE: 'Resgate',
};
