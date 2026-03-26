export interface IncomeStatement {
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

export interface RaisConsistency {
  yearBase: number;
  totalEmployees: number;
  employeesWithAdmission: number;
  employeesWithRemuneration: number;
  employeesWithTermination: number;
  missingAdmissionEvents: string[];
  missingRemunerationEvents: string[];
  isConsistent: boolean;
}

export interface GenerateIncomeStatementsInput {
  yearBase: number;
  employeeIds?: string[];
}
