export type ContractType =
  | 'CLT_INDETERMINATE'
  | 'CLT_DETERMINATE'
  | 'SEASONAL'
  | 'INTERMITTENT'
  | 'TRIAL'
  | 'APPRENTICE';

export interface EmployeeContract {
  id: string;
  employeeId: string;
  positionId: string;
  workScheduleId?: string;
  contractType: ContractType;
  startDate: string;
  endDate?: string;
  salary: number;
  weeklyHours: number;
  union?: string;
  costCenterId?: string;
  notes?: string;
  isActive: boolean;
  position?: { name: string };
  workSchedule?: { name: string };
  amendments?: ContractAmendment[];
}

export interface ContractAmendment {
  id: string;
  description: string;
  effectiveAt: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdBy: string;
  createdAt: string;
}

export interface EmployeeContractsResponse {
  data: EmployeeContract[];
  total: number;
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  CLT_INDETERMINATE: 'CLT — Prazo indeterminado',
  CLT_DETERMINATE: 'CLT — Prazo determinado',
  SEASONAL: 'Safra',
  INTERMITTENT: 'Intermitente',
  TRIAL: 'Experiência',
  APPRENTICE: 'Aprendiz',
};
