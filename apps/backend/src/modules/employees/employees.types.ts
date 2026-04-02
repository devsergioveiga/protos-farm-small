// ─── Employee Types ──────────────────────────────────────────────────

export class EmployeeError extends Error {
  statusCode: number;
  data?: Record<string, unknown>;

  constructor(message: string, statusCode = 400, data?: Record<string, unknown>) {
    super(message);
    this.name = 'EmployeeError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateDependentInput {
  name: string;
  cpf?: string;
  birthDate: string;
  relationship: string;
  irrf?: boolean;
  salaryFamily?: boolean;
}

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
  birthDate: string; // ISO date string
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
  bankAccountType?: 'CORRENTE' | 'POUPANCA';
  bankAccountDigit?: string;
  initialVacationBalance?: number;
  initialHourBankBalance?: number;
  admissionDate: string; // ISO date string
  notes?: string;
  // Optional initial salary (for salary history)
  salary?: number;
  // Dependents inline on creation
  dependents?: CreateDependentInput[];
  // Farm association on creation
  farmId?: string;
  positionId?: string;
}

export type UpdateEmployeeInput = Partial<
  Omit<CreateEmployeeInput, 'cpf' | 'dependents' | 'farmId' | 'positionId'>
>;

export interface TransitionStatusInput {
  newStatus: 'ATIVO' | 'AFASTADO' | 'FERIAS' | 'DESLIGADO';
  reason: string;
}

export interface ListEmployeeParams {
  status?: string;
  farmId?: string;
  positionId?: string;
  functionFilter?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AddFarmAssocInput {
  farmId: string;
  positionId?: string;
  startDate?: string;
}

export interface EmployeeDocumentInput {
  documentType: 'RG' | 'CPF' | 'CTPS' | 'ASO' | 'CONTRATO' | 'OUTRO';
}

// ─── Employee Functions ────────────────────────────────────────────

export const EMPLOYEE_FUNCTIONS = [
  'INSEMINATOR',
  'TRACTOR_DRIVER',
  'VETERINARIAN',
  'MILKING_OPERATOR',
] as const;

export type EmployeeFunctionValue = (typeof EMPLOYEE_FUNCTIONS)[number];

export interface AssignFunctionInput {
  function: string;
}
