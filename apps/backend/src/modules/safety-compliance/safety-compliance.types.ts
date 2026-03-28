export class SafetyComplianceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'SafetyComplianceError';
  }
}

export type ComplianceAlertLevel = 'OK' | 'YELLOW' | 'RED' | 'EXPIRED';

export interface ComplianceSummary {
  totalEmployees: number;
  compliantCount: number;
  compliantPercent: number;
  pendingCount: number;
  expiringIn30Days: number;
}

export interface EpiPendingItem {
  epiProductName: string;
  epiType: string;
  required: number;
  delivered: number;
}

export interface TrainingPendingItem {
  trainingTypeName: string;
  nrReference: string | null;
  expiresAt: string | null;
  status: ComplianceAlertLevel;
}

export interface EmployeeComplianceOutput {
  employeeId: string;
  employeeName: string;
  positionName: string | null;
  epiCompliance: { total: number; compliant: number; pending: EpiPendingItem[] };
  trainingCompliance: { total: number; compliant: number; expired: TrainingPendingItem[] };
  asoCompliance: {
    latestResult: string | null;
    nextExamDate: string | null;
    expiryStatus: ComplianceAlertLevel;
  };
  overallStatus: ComplianceAlertLevel;
}

export interface ComplianceDashboardQuery {
  farmId?: string;
  pendingType?: 'EPI' | 'TRAINING' | 'ASO';
  search?: string;
  page?: number;
  limit?: number;
}

// Helper function — shared across modules
export function classifyExpiryAlert(
  nextDate: Date | null,
  today: Date = new Date(),
): ComplianceAlertLevel {
  if (!nextDate) return 'OK';
  const daysUntil = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return 'EXPIRED';
  if (daysUntil <= 15) return 'RED';
  if (daysUntil <= 30) return 'YELLOW';
  return 'OK';
}
