export interface CreatePositionInput {
  name: string;
  cbo?: string; // 6 numeric digits
  description?: string;
  additionalTypes?: string[]; // e.g. ["INSALUBRIDADE", "PERICULOSIDADE"]
}

export interface UpdatePositionInput {
  name?: string;
  cbo?: string;
  description?: string;
  additionalTypes?: string[];
  isActive?: boolean;
}

export interface CreateSalaryBandInput {
  level: 'JUNIOR' | 'PLENO' | 'SENIOR';
  minSalary: number;
  maxSalary: number;
}

export interface ListPositionsParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface PositionOutput {
  id: string;
  organizationId: string;
  name: string;
  cbo: string | null;
  description: string | null;
  additionalTypes: string[];
  isActive: boolean;
  salaryBandsCount: number;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryBandOutput {
  id: string;
  positionId: string;
  level: 'JUNIOR' | 'PLENO' | 'SENIOR';
  minSalary: number;
  maxSalary: number;
}

export interface PositionDetailOutput extends PositionOutput {
  salaryBands: SalaryBandOutput[];
}

export interface StaffingViewItem {
  positionId: string;
  positionName: string;
  cbo: string | null;
  totalEmployees: number;
  byFarm: Array<{ farmId: string; farmName: string; count: number }>;
}

export class PositionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'PositionError';
    this.statusCode = statusCode;
  }
}
