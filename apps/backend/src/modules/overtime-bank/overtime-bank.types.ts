import type { OvertimeBankType } from '@prisma/client';

export interface CreateOvertimeBankInput {
  employeeId: string;
  referenceMonth: string;
  minutes: number;
  balanceType: OvertimeBankType;
  description?: string;
  expiresAt: string;
  timesheetId?: string;
}

export interface OvertimeBankQuery {
  employeeId?: string;
  expiringBefore?: string;
  page?: number;
  limit?: number;
}

export interface OvertimeBankOutput {
  id: string;
  employeeId: string;
  employeeName: string;
  referenceMonth: string;
  minutes: number;
  balanceType: OvertimeBankType;
  description: string | null;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
}

export interface OvertimeBankSummary {
  employeeId: string;
  employeeName: string;
  totalCredits: number;
  totalCompensations: number;
  totalExpirations: number;
  currentBalance: number;
  expiringIn30Days: number;
  expiringIn7Days: number;
  entries: OvertimeBankOutput[];
}
