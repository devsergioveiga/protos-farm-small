// ─── CNAB Adapter Interface ────────────────────────────────────────────────
//
// Each bank implements CnabAdapter with methods for generating remessa files
// (CNAB 240/400) and parsing retorno (bank return) files.
// The payables service calls the adapter by bank code — never with
// bank-specific logic in the service itself.

export interface CnabHeaderData {
  /** Company name (up to 30 chars) */
  companyName: string;
  /** CNPJ or CPF of company (only digits) */
  companyDocument: string;
  /** Bank convenio/agreement code */
  convenioCode: string;
  /** Agency number (only digits) */
  agency: string;
  /** Agency check digit */
  agencyDigit?: string;
  /** Account number (only digits) */
  accountNumber: string;
  /** Account check digit */
  accountDigit?: string;
  /** Carteira (portfolio) code */
  carteira?: string;
  /** Variação carteira */
  variacao?: string;
  /** File generation date */
  fileDate: Date;
  /** Sequential number of the file (remessa sequential) */
  sequentialNumber: number;
}

export interface CnabPaymentRecord {
  /** Internal payable ID — used as "nosso número" reference */
  payableId: string;
  /** Amount in BRL (not centavos — adapter converts internally) */
  amount: number;
  /** Payment due date */
  dueDate: Date;
  /** Supplier/beneficiary name (up to 30 chars) */
  supplierName: string;
  /** Supplier CPF or CNPJ (only digits) */
  supplierDocument?: string;
  /** Supplier bank code */
  bankCode?: string;
  /** Supplier agency (only digits) */
  agency?: string;
  /** Supplier agency digit */
  agencyDigit?: string;
  /** Supplier account number (only digits) */
  accountNumber?: string;
  /** Supplier account digit */
  accountDigit?: string;
  /** Document number (optional) */
  documentNumber?: string;
}

export interface CnabReturnRecord {
  /** Nosso número — links back to internal payableId */
  ourNumber: string;
  /** Normalized status */
  status: 'LIQUIDATED' | 'RETURNED' | 'REJECTED';
  /** Bank-specific status code (e.g. '00', '02', '09') */
  statusCode: string;
  /** Date the payment was liquidated */
  liquidationDate?: Date;
  /** Actual amount paid */
  amountPaid?: number;
}

export interface CnabAdapter {
  /** FEBRABAN bank code — '001' for BB, '756' for Sicoob */
  bankCode: string;
  /** Human-readable bank name */
  bankName: string;
  /** Generate CNAB 240 remessa file content */
  generateRemessa240(headerData: CnabHeaderData, payments: CnabPaymentRecord[]): string;
  /** Generate CNAB 400 remessa file content */
  generateRemessa400(headerData: CnabHeaderData, payments: CnabPaymentRecord[]): string;
  /** Parse retorno file content into structured records */
  parseRetorno(fileContent: string): CnabReturnRecord[];
}

// ─── Adapter Registry ──────────────────────────────────────────────────────
// Populated lazily to avoid circular import issues

let _adaptersMap: Map<string, CnabAdapter> | null = null;

function getAdaptersMap(): Map<string, CnabAdapter> {
  if (!_adaptersMap) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { bb001Adapter } = require('./adapters/bb-001.adapter');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sicoob756Adapter } = require('./adapters/sicoob-756.adapter');
    _adaptersMap = new Map<string, CnabAdapter>([
      ['001', bb001Adapter],
      ['756', sicoob756Adapter],
    ]);
  }
  return _adaptersMap;
}

export function getCnabAdapter(bankCode: string): CnabAdapter {
  const adapter = getAdaptersMap().get(bankCode);
  if (!adapter) {
    throw new Error(`CNAB adapter não disponível para banco ${bankCode}`);
  }
  return adapter;
}
