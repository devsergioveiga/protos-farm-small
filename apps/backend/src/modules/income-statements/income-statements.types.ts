export class IncomeStatementError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'IncomeStatementError';
  }
}

export interface IncomeStatementOutput {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName: string;
  employeeCpf: string;
  yearBase: number;
  totalTaxable: string;
  totalInss: string;
  totalIrrf: string;
  totalExempt: string;
  dependentDeduction: string;
  pdfKey: string | null;
  sentAt: string | null;
  sentTo: string | null;
  createdBy: string;
  createdAt: string;
}

export interface GenerateIncomeStatementsInput {
  yearBase: number;
  employeeIds?: string[]; // if omitted, generate for all employees with runs in the year
}

export interface ListIncomeStatementsQuery {
  yearBase?: number;
  employeeId?: string;
  page?: number;
  limit?: number;
}

export interface RaisConsistencyOutput {
  yearBase: number;
  totalEmployees: number;
  employeesWithAdmission: number;
  employeesWithRemuneration: number;
  employeesWithTermination: number;
  missingAdmissionEvents: string[]; // employee names
  missingRemunerationEvents: string[];
  isConsistent: boolean;
}

export interface SendIncomeStatementsInput {
  yearBase: number;
  employeeIds?: string[];
}
