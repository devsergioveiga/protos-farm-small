export interface TrainingType {
  id: string;
  name: string;
  description: string | null;
  minHours: number;
  defaultValidityMonths: number;
  nrReference: string | null;
  isSystem: boolean;
  isGlobal: boolean;
  organizationId: string | null;
  createdAt: string;
}

export interface TrainingRecord {
  id: string;
  trainingTypeId: string;
  trainingTypeName: string;
  date: string;
  instructorName: string;
  instructorType: 'INTERNO' | 'EXTERNO';
  instructorRegistration: string | null;
  effectiveHours: number;
  location: string | null;
  observations: string | null;
  attendanceListUrl: string | null;
  farmId: string | null;
  participantCount: number;
  participants: EmployeeTrainingRecord[];
  createdAt: string;
}

export interface EmployeeTrainingRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  expiresAt: string;
}

export interface PositionTrainingRequirement {
  id: string;
  positionId: string;
  positionName: string;
  trainingTypeId: string;
  trainingTypeName: string;
}

export interface CreateTrainingTypeInput {
  name: string;
  description?: string;
  minHours: number;
  defaultValidityMonths: number;
  nrReference?: string;
  isGlobal?: boolean;
}

export interface UpdateTrainingTypeInput {
  name?: string;
  description?: string;
  minHours?: number;
  defaultValidityMonths?: number;
  nrReference?: string;
  isGlobal?: boolean;
}

export interface CreateTrainingRecordInput {
  trainingTypeId: string;
  date: string;
  instructorName: string;
  instructorType: 'INTERNO' | 'EXTERNO';
  instructorRegistration?: string;
  effectiveHours: number;
  location?: string;
  observations?: string;
  attendanceListUrl?: string;
  farmId?: string;
  employeeIds: string[];
}

export interface CreatePositionTrainingRequirementInput {
  positionId: string;
  trainingTypeId: string;
}

export const INSTRUCTOR_TYPE_LABELS: Record<string, string> = {
  INTERNO: 'Interno',
  EXTERNO: 'Externo',
};
