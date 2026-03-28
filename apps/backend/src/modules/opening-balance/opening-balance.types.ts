export class OpeningBalanceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 422,
  ) {
    super(message);
    Object.setPrototypeOf(this, OpeningBalanceError.prototype);
    this.name = 'OpeningBalanceError';
  }
}

export type OpeningBalanceSource =
  | 'BANK_BALANCE'
  | 'PAYABLE'
  | 'RECEIVABLE'
  | 'ASSET_NBV'
  | 'PAYROLL_PROVISION';

export interface OpeningBalanceLinePreview {
  accountId: string;
  accountCode: string;
  accountName: string;
  side: 'DEBIT' | 'CREDIT';
  amount: string; // decimal string
  source: OpeningBalanceSource;
  description: string; // e.g. "Saldo bancario — Banco do Brasil"
}

export interface PostOpeningBalanceInput {
  fiscalYearId: string;
  periodId: string;
  lines: Array<{
    accountId: string;
    side: 'DEBIT' | 'CREDIT';
    amount: string;
    description?: string;
  }>;
}
