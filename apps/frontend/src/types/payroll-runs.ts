export type PayrollRunType = 'MONTHLY' | 'ADVANCE' | 'THIRTEENTH_FIRST' | 'THIRTEENTH_SECOND';
export type PayrollRunStatus = 'PENDING' | 'PROCESSING' | 'CALCULATED' | 'COMPLETED' | 'ERROR' | 'REVERTED';

export interface PayrollRun {
  id: string;
  organizationId: string;
  referenceMonth: string;
  runType: PayrollRunType;
  status: PayrollRunStatus;
  triggeredBy: string;
  closedAt: string | null;
  closedBy: string | null;
  revertedAt: string | null;
  revertedBy: string | null;
  totalGross: number | null;
  totalNet: number | null;
  totalCharges: number | null;
  employeeCount: number;
  notes: string | null;
  createdAt: string;
  items?: PayrollRunItem[];
}

export interface PayrollRunItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName?: string;
  status: string;
  baseSalary: number;
  proRataDays: number | null;
  overtime50: number;
  overtime100: number;
  dsrValue: number;
  nightPremium: number;
  salaryFamily: number;
  grossSalary: number;
  inssAmount: number;
  irrfAmount: number;
  vtDeduction: number;
  housingDeduction: number;
  foodDeduction: number;
  advanceDeduction: number;
  otherDeductions: number;
  netSalary: number;
  fgtsAmount: number;
  inssPatronal: number;
  lineItemsJson: unknown;
  payslipSentAt: string | null;
}

export interface SalaryAdvance {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName?: string;
  referenceMonth: string;
  amount: number;
  advanceDate: string;
  batchId: string | null;
  notes: string | null;
  payableId: string | null;
  payableStatus?: string;
  deductedInRunId: string | null;
  createdAt: string;
}

export interface WizardEmployeePreview {
  id: string;
  name: string;
  salary: number;
  timesheetStatus: 'APPROVED' | 'PENDING' | null;
  eligible: boolean;
}

export interface CreateAdvanceInput {
  employeeId: string;
  referenceMonth: string;
  amount: number;
  advanceDate: string;
  notes?: string;
}

export interface BatchAdvanceInput {
  referenceMonth: string;
  advanceDate: string;
  percentOfSalary?: number; // default 40
  notes?: string;
}

export const RUN_TYPE_LABELS: Record<PayrollRunType, string> = {
  MONTHLY: 'Mensal',
  ADVANCE: 'Adiantamento',
  THIRTEENTH_FIRST: '13o - 1a Parcela',
  THIRTEENTH_SECOND: '13o - 2a Parcela',
};

export const RUN_STATUS_LABELS: Record<PayrollRunStatus, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  CALCULATED: 'Calculado',
  COMPLETED: 'Fechado',
  ERROR: 'Erro',
  REVERTED: 'Estornado',
};
