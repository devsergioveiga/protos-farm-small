export type ProvisionType = 'VACATION' | 'THIRTEENTH';

export const PROVISION_TYPE_LABELS: Record<ProvisionType, string> = {
  VACATION: 'Ferias',
  THIRTEENTH: 'Decimo Terceiro',
};

export interface PayrollProvision {
  id: string;
  employeeId: string;
  employeeName: string;
  referenceMonth: string;
  provisionType: ProvisionType;
  baseSalary: number;
  provisionAmount: number;
  chargesAmount: number;
  totalAmount: number;
  costCenterName: string | null;
  reversedAt: string | null;
}

export interface ProvisionReportRow {
  costCenterId: string | null;
  costCenterName: string;
  vacationTotal: number;
  thirteenthTotal: number;
  chargesTotal: number;
  grandTotal: number;
}

export interface CalculateProvisionsResult {
  processedCount: number;
  totalVacation: number;
  totalThirteenth: number;
  totalCharges: number;
}

export interface CalculateProvisionsInput {
  referenceMonth: string;
}
