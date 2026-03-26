export type TerminationType =
  | 'WITHOUT_CAUSE'
  | 'WITH_CAUSE'
  | 'VOLUNTARY'
  | 'SEASONAL_END'
  | 'MUTUAL_AGREEMENT';

export type TerminationStatus = 'DRAFT' | 'PROCESSED' | 'PAID';

export const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
  WITHOUT_CAUSE: 'Sem Justa Causa',
  WITH_CAUSE: 'Justa Causa',
  VOLUNTARY: 'Pedido de Demissao',
  SEASONAL_END: 'Fim de Safra',
  MUTUAL_AGREEMENT: 'Acordo Mutuo',
};

export const TERMINATION_STATUS_LABELS: Record<TerminationStatus, string> = {
  DRAFT: 'Rascunho',
  PROCESSED: 'Processado',
  PAID: 'Pago',
};

export interface EmployeeTermination {
  id: string;
  employeeId: string;
  employeeName: string;
  terminationType: TerminationType;
  terminationDate: string;
  noticePeriodDays: number;
  noticePeriodType: string;
  balanceSalary: number;
  thirteenthProp: number;
  vacationVested: number;
  vacationProp: number;
  vacationBonus: number;
  noticePay: number;
  fgtsBalance: number;
  fgtsPenalty: number;
  totalGross: number;
  inssAmount: number;
  irrfAmount: number;
  totalNet: number;
  paymentDeadline: string;
  status: TerminationStatus;
  trctPdfUrl: string | null;
  grfPdfUrl: string | null;
}

export interface CreateTerminationInput {
  employeeId: string;
  terminationType: string;
  terminationDate: string;
  noticePeriodType: string;
}
