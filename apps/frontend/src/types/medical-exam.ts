export type AsoType =
  | 'ADMISSIONAL'
  | 'PERIODICO'
  | 'RETORNO_TRABALHO'
  | 'MUDANCA_RISCO'
  | 'DEMISSIONAL';

export type AsoResult = 'APTO' | 'INAPTO' | 'APTO_COM_RESTRICAO';

export interface MedicalExam {
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

export const ASO_TYPE_LABELS: Record<AsoType, string> = {
  ADMISSIONAL: 'Admissional',
  PERIODICO: 'Periódico',
  RETORNO_TRABALHO: 'Retorno ao Trabalho',
  MUDANCA_RISCO: 'Mudança de Risco',
  DEMISSIONAL: 'Demissional',
};

export const ASO_RESULT_LABELS: Record<AsoResult, string> = {
  APTO: 'Apto',
  INAPTO: 'Inapto',
  APTO_COM_RESTRICAO: 'Apto com restrição',
};
