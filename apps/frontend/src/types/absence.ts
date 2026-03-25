export type AbsenceType =
  | 'MEDICAL_CERTIFICATE'
  | 'INSS_LEAVE'
  | 'WORK_ACCIDENT'
  | 'MATERNITY'
  | 'PATERNITY'
  | 'MARRIAGE'
  | 'BEREAVEMENT'
  | 'MILITARY'
  | 'OTHER';

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  MEDICAL_CERTIFICATE: 'Atestado Medico',
  INSS_LEAVE: 'Afastamento INSS',
  WORK_ACCIDENT: 'Acidente de Trabalho',
  MATERNITY: 'Licenca-Maternidade',
  PATERNITY: 'Licenca-Paternidade',
  MARRIAGE: 'Casamento',
  BEREAVEMENT: 'Falecimento',
  MILITARY: 'Servico Militar',
  OTHER: 'Outro',
};

// Fixed duration types in days (0 = open-ended)
export const ABSENCE_TYPE_FIXED_DAYS: Partial<Record<AbsenceType, number>> = {
  MATERNITY: 120,
  PATERNITY: 5,
  MARRIAGE: 3,
  BEREAVEMENT: 2,
};

export interface EmployeeAbsence {
  id: string;
  employeeId: string;
  employeeName: string;
  absenceType: AbsenceType;
  startDate: string;
  endDate: string | null;
  totalDays: number | null;
  catNumber: string | null;
  inssStartDate: string | null;
  stabilityEndsAt: string | null;
  returnDate: string | null;
  asoRequired: boolean;
  payrollImpact: string | null;
  notes: string | null;
}

export interface CreateAbsenceInput {
  employeeId: string;
  absenceType: string;
  startDate: string;
  endDate?: string;
  catNumber?: string;
  notes?: string;
}

export interface RegisterReturnInput {
  returnDate: string;
}
