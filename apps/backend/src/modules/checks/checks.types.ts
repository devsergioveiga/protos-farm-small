// ─── Error ───────────────────────────────────────────────────────────

export class CheckError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'CheckError';
  }
}

// ─── Inputs ──────────────────────────────────────────────────────────

export interface CreateCheckInput {
  type: 'EMITIDO' | 'RECEBIDO';
  checkNumber: string; // string livre, max 20
  amount: number;
  bankAccountId: string;
  issueDate: string; // ISO date
  deliveryDate?: string;
  expectedCompensationDate?: string;
  payeeName: string; // beneficiario (EMITIDO) or emitente (RECEBIDO)
  description?: string;
  notes?: string;
}

export interface ListChecksQuery {
  status?: string; // comma-separated statuses
  type?: string; // EMITIDO | RECEBIDO
  startDate?: string;
  endDate?: string;
}

// ─── Outputs ─────────────────────────────────────────────────────────

export interface CheckOutput {
  id: string;
  type: string;
  status: string;
  checkNumber: string;
  amount: number;
  bankAccountId: string;
  bankAccountName: string;
  issueDate: string;
  deliveryDate: string | null;
  expectedCompensationDate: string | null;
  compensationDate: string | null;
  payeeName: string;
  description: string | null;
  notes: string | null;
  createdAt: string;
}

// ─── State machine ───────────────────────────────────────────────────

// Valid state transitions map
export const VALID_TRANSITIONS: Record<string, string[]> = {
  EMITIDO: ['A_COMPENSAR', 'CANCELADO'],
  A_COMPENSAR: ['COMPENSADO', 'DEVOLVIDO', 'CANCELADO'],
  DEVOLVIDO: ['A_COMPENSAR', 'CANCELADO'],
  COMPENSADO: [],
  CANCELADO: [],
};
