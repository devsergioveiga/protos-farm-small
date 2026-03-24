export type SalaryBandLevel = 'JUNIOR' | 'PLENO' | 'SENIOR';

export interface Position {
  id: string;
  organizationId: string;
  name: string;
  cbo?: string;
  description?: string;
  additionalTypes: string[];
  isActive: boolean;
  salaryBands?: SalaryBand[];
  _count?: { employeeFarms: number };
}

export interface SalaryBand {
  id: string;
  positionId: string;
  level: SalaryBandLevel;
  minSalary: number;
  maxSalary: number;
}

export interface StaffingViewItem {
  positionId: string;
  positionName: string;
  cbo: string | null;
  totalEmployees: number;
  byFarm: Array<{ farmId: string; farmName: string; count: number }>;
}

export interface PositionsResponse {
  data: Position[];
  total: number;
}

export const SALARY_BAND_LABELS: Record<SalaryBandLevel, string> = {
  JUNIOR: 'Junior',
  PLENO: 'Pleno',
  SENIOR: 'Senior',
};
