export type ContractTypeLiteral =
  | 'CLT_INDETERMINATE'
  | 'CLT_DETERMINATE'
  | 'SEASONAL'
  | 'INTERMITTENT'
  | 'TRIAL'
  | 'APPRENTICE';

export interface CreateContractInput {
  employeeId: string;
  positionId: string;
  workScheduleId?: string;
  contractType: ContractTypeLiteral;
  startDate: string; // ISO date
  endDate?: string; // ISO date — conditional by contractType
  salary: number;
  weeklyHours?: number; // default 44
  union?: string;
  costCenterId?: string;
  notes?: string;
}

export interface UpdateContractInput {
  union?: string;
  costCenterId?: string;
  notes?: string;
  weeklyHours?: number;
}

export interface CreateAmendmentInput {
  description: string;
  effectiveAt: string; // ISO date
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface ListContractsParams {
  employeeId?: string;
  contractType?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ContractOutput {
  id: string;
  employeeId: string;
  organizationId: string;
  positionId: string;
  workScheduleId: string | null;
  contractType: ContractTypeLiteral;
  startDate: string;
  endDate: string | null;
  salary: number;
  weeklyHours: number;
  union: string | null;
  costCenterId: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  positionName?: string;
  workScheduleName?: string | null;
  amendmentsCount?: number;
}

export interface ContractDetailOutput extends ContractOutput {
  amendments: AmendmentOutput[];
}

export interface AmendmentOutput {
  id: string;
  contractId: string;
  description: string;
  effectiveAt: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdBy: string;
  createdAt: string;
}

// Labels in pt-BR for PDF
export const CONTRACT_TYPE_LABELS: Record<ContractTypeLiteral, string> = {
  CLT_INDETERMINATE: 'CLT por Prazo Indeterminado',
  CLT_DETERMINATE: 'CLT por Prazo Determinado',
  SEASONAL: 'Contrato de Safra',
  INTERMITTENT: 'Contrato Intermitente',
  TRIAL: 'Contrato de Experiência',
  APPRENTICE: 'Contrato de Aprendiz',
};

// ContractType validation rules
export const CONTRACT_END_DATE_RULES: Record<
  ContractTypeLiteral,
  { required: boolean; forbidden: boolean; maxDays?: number }
> = {
  CLT_INDETERMINATE: { required: false, forbidden: true },
  CLT_DETERMINATE: { required: true, forbidden: false },
  SEASONAL: { required: true, forbidden: false },
  TRIAL: { required: true, forbidden: false, maxDays: 90 },
  INTERMITTENT: { required: false, forbidden: true },
  APPRENTICE: { required: true, forbidden: false, maxDays: 730 }, // 2 years
};

export class EmployeeContractError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'EmployeeContractError';
    this.statusCode = statusCode;
  }
}
