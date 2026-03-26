export class MedicalExamError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MedicalExamError';
  }
}

export const ASO_TYPES = [
  'ADMISSIONAL',
  'PERIODICO',
  'RETORNO_TRABALHO',
  'MUDANCA_RISCO',
  'DEMISSIONAL',
] as const;
export type AsoType = (typeof ASO_TYPES)[number];

export const ASO_RESULTS = ['APTO', 'INAPTO', 'APTO_COM_RESTRICAO'] as const;
export type AsoResult = (typeof ASO_RESULTS)[number];

export interface CreateMedicalExamInput {
  employeeId: string;
  farmId?: string;
  type: AsoType;
  date: string;
  doctorName: string;
  doctorCrm: string;
  result: AsoResult;
  restrictions?: string;
  nextExamDate?: string;
  documentUrl?: string;
  observations?: string;
}

export interface UpdateMedicalExamInput {
  type?: AsoType;
  date?: string;
  doctorName?: string;
  doctorCrm?: string;
  result?: AsoResult;
  restrictions?: string;
  nextExamDate?: string;
  documentUrl?: string;
  observations?: string;
}

export interface MedicalExamOutput {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string | null;
  farmId: string | null;
  type: AsoType;
  date: string;
  doctorName: string;
  doctorCrm: string;
  result: AsoResult;
  restrictions: string | null;
  nextExamDate: string | null;
  expiryStatus: 'OK' | 'YELLOW' | 'RED' | 'EXPIRED';
  documentUrl: string | null;
  observations: string | null;
  createdAt: string;
}

export interface MedicalExamListQuery {
  employeeId?: string;
  type?: string;
  result?: string;
  expiryStatus?: string;
  farmId?: string;
  page?: number;
  limit?: number;
}
