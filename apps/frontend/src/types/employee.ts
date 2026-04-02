import type { EmployeeContract } from './employee-contract';

export type EmployeeStatus = 'ATIVO' | 'AFASTADO' | 'FERIAS' | 'DESLIGADO';
export type BankAccountType = 'CORRENTE' | 'POUPANCA';
export type DocumentType = 'RG' | 'CPF' | 'CTPS' | 'ASO' | 'CONTRATO' | 'OUTRO';

export interface Employee {
  id: string;
  organizationId: string;
  userId?: string;
  name: string;
  cpf: string;
  rg?: string;
  rgIssuer?: string;
  rgUf?: string;
  pisPassep?: string;
  ctpsNumber?: string;
  ctpsSeries?: string;
  ctpsUf?: string;
  birthDate: string;
  motherName?: string;
  fatherName?: string;
  educationLevel?: string;
  maritalStatus?: string;
  nationality: string;
  bloodType?: string;
  hasDisability: boolean;
  disabilityType?: string;
  phone?: string;
  email?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  bankCode?: string;
  bankAgency?: string;
  bankAccount?: string;
  bankAccountType?: BankAccountType;
  bankAccountDigit?: string;
  initialVacationBalance?: number;
  initialHourBankBalance?: number;
  status: EmployeeStatus;
  photoUrl?: string;
  notes?: string;
  admissionDate: string;
  terminationDate?: string;
  createdAt: string;
  updatedAt: string;
  // Relations (populated in detail)
  farms?: EmployeeFarm[];
  dependents?: EmployeeDependent[];
  documents?: EmployeeDocument[];
  contracts?: EmployeeContract[];
  functions?: EmployeeFunctionAssignment[];
}

export interface EmployeeDependent {
  id: string;
  name: string;
  cpf?: string;
  birthDate: string;
  relationship: string;
  irrf: boolean;
  salaryFamily: boolean;
}

export interface EmployeeFarm {
  id: string;
  farmId: string;
  positionId?: string;
  startDate: string;
  endDate?: string;
  status: string;
  farm?: { name: string };
  position?: { name: string; asoPeriodicityMonths?: number };
}

export interface EmployeeDocument {
  id: string;
  documentType: DocumentType;
  fileName: string;
  filePath: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface EmployeeStatusHistory {
  id: string;
  fromStatus: EmployeeStatus;
  toStatus: EmployeeStatus;
  reason: string;
  changedBy: string;
  effectiveAt: string;
}

export interface SalaryHistoryPoint {
  effectiveAt: string;
  salary: number;
  movementType: string;
  reason?: string;
}

export interface EmployeesResponse {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
}

// Input types for forms
export interface CreateEmployeeInput {
  name: string;
  cpf: string;
  rg?: string;
  rgIssuer?: string;
  rgUf?: string;
  pisPassep?: string;
  ctpsNumber?: string;
  ctpsSeries?: string;
  ctpsUf?: string;
  birthDate: string;
  motherName?: string;
  fatherName?: string;
  educationLevel?: string;
  maritalStatus?: string;
  nationality?: string;
  bloodType?: string;
  hasDisability?: boolean;
  disabilityType?: string;
  phone?: string;
  email?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  bankCode?: string;
  bankAgency?: string;
  bankAccount?: string;
  bankAccountType?: BankAccountType;
  bankAccountDigit?: string;
  admissionDate: string;
  notes?: string;
  dependents?: Array<{
    name: string;
    cpf?: string;
    birthDate: string;
    relationship: string;
    irrf?: boolean;
    salaryFamily?: boolean;
  }>;
  farmId?: string;
  positionId?: string;
}

// ─── Employee Functions ────────────────────────────────────────────

export type EmployeeFunctionType =
  | 'INSEMINATOR'
  | 'TRACTOR_DRIVER'
  | 'VETERINARIAN'
  | 'MILKING_OPERATOR';

export const EMPLOYEE_FUNCTION_LABELS: Record<EmployeeFunctionType, string> = {
  INSEMINATOR: 'Inseminador',
  TRACTOR_DRIVER: 'Tratorista',
  VETERINARIAN: 'Veterinário',
  MILKING_OPERATOR: 'Ordenhador',
};

export const EMPLOYEE_FUNCTION_OPTIONS: { value: EmployeeFunctionType; label: string }[] = [
  { value: 'INSEMINATOR', label: 'Inseminador' },
  { value: 'TRACTOR_DRIVER', label: 'Tratorista' },
  { value: 'VETERINARIAN', label: 'Veterinário' },
  { value: 'MILKING_OPERATOR', label: 'Ordenhador' },
];

export interface EmployeeFunctionAssignment {
  id: string;
  function: EmployeeFunctionType;
  assignedAt: string;
}

// Labels
export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ATIVO: 'Ativo',
  AFASTADO: 'Afastado',
  FERIAS: 'Férias',
  DESLIGADO: 'Desligado',
};
