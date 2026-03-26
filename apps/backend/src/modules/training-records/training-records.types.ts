export class TrainingRecordError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TrainingRecordError';
  }
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
  employeeIds: string[]; // participants
}

export interface TrainingRecordOutput {
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
  participants: EmployeeTrainingRecordOutput[];
  createdAt: string;
}

export interface EmployeeTrainingRecordOutput {
  id: string;
  employeeId: string;
  employeeName: string;
  expiresAt: string;
}

export interface TrainingRecordListQuery {
  trainingTypeId?: string;
  instructorType?: string;
  dateFrom?: string;
  dateTo?: string;
  farmId?: string;
  page?: number;
  limit?: number;
}
