// ─── Safety / NR-31 Compliance Types ─────────────────────────────────────────

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

export interface EmployeeCompliance {
  employeeId: string;
  employeeName: string;
  positionName: string | null;
  epiCompliance: {
    total: number;
    compliant: number;
    pending: EpiPendingItem[];
  };
  trainingCompliance: {
    total: number;
    compliant: number;
    expired: TrainingPendingItem[];
  };
  asoCompliance: {
    latestResult: string | null;
    nextExamDate: string | null;
    expiryStatus: ComplianceAlertLevel;
  };
  overallStatus: ComplianceAlertLevel;
}

export interface SafetyDashboard {
  summary: ComplianceSummary;
  nonCompliantEmployees: EmployeeCompliance[];
}
