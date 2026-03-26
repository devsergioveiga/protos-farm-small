import type { EsocialGroup, EsocialStatus } from '@prisma/client';

export class EsocialEventError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'EsocialEventError';
  }
}

export interface EsocialValidationError {
  field: string;
  employeeName?: string;
  message: string;
}

export interface EsocialEventOutput {
  id: string;
  organizationId: string;
  eventType: string;
  eventGroup: EsocialGroup;
  referenceMonth: string | null;
  sourceType: string;
  sourceId: string;
  status: EsocialStatus;
  version: number;
  xmlContent: string | null;
  rejectionReason: string | null;
  exportedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  validationErrors?: EsocialValidationError[];
}

export interface GenerateEsocialEventInput {
  eventType: string;
  sourceType: string;
  sourceId: string;
  referenceMonth?: string;
}

export interface UpdateEsocialStatusInput {
  status: 'ACEITO' | 'REJEITADO';
  rejectionReason?: string;
}

export interface ListEsocialEventsQuery {
  referenceMonth?: string;
  eventGroup?: EsocialGroup;
  eventType?: string;
  status?: EsocialStatus;
  page?: number;
  limit?: number;
}

export interface EsocialDashboardOutput {
  referenceMonth: string;
  total: number;
  pendente: number;
  exportado: number;
  aceito: number;
  rejeitado: number;
  byGroup: Record<EsocialGroup, { total: number; pendente: number; exportado: number; aceito: number; rejeitado: number }>;
}

// State machine transitions (per D-10)
export const VALID_ESOCIAL_TRANSITIONS: Record<string, Record<string, string>> = {
  EXPORT: { PENDENTE: 'EXPORTADO' as const },
  ACCEPT: { EXPORTADO: 'ACEITO' as const },
  REJECT: { EXPORTADO: 'REJEITADO' as const },
  REPROCESS: { REJEITADO: 'PENDENTE' as const },
};

// Event type constants
export const ESOCIAL_EVENT_TYPES = {
  // Tabela
  S_1000: 'S-1000',
  S_1005: 'S-1005',
  S_1010: 'S-1010',
  S_1020: 'S-1020',
  // Nao Periodico
  S_2190: 'S-2190',
  S_2200: 'S-2200',
  S_2206: 'S-2206',
  S_2230: 'S-2230',
  S_2299: 'S-2299',
  // Periodico
  S_1200: 'S-1200',
  S_1210: 'S-1210',
  S_1299: 'S-1299',
  // SST
  S_2210: 'S-2210',
  S_2220: 'S-2220',
  S_2240: 'S-2240',
} as const;

export const EVENT_GROUP_MAP: Record<string, EsocialGroup> = {
  'S-1000': 'TABELA' as const,
  'S-1005': 'TABELA' as const,
  'S-1010': 'TABELA' as const,
  'S-1020': 'TABELA' as const,
  'S-2190': 'NAO_PERIODICO' as const,
  'S-2200': 'NAO_PERIODICO' as const,
  'S-2206': 'NAO_PERIODICO' as const,
  'S-2230': 'NAO_PERIODICO' as const,
  'S-2299': 'NAO_PERIODICO' as const,
  'S-1200': 'PERIODICO' as const,
  'S-1210': 'PERIODICO' as const,
  'S-1299': 'PERIODICO' as const,
  'S-2210': 'SST' as const,
  'S-2220': 'SST' as const,
  'S-2240': 'SST' as const,
};

export const SOURCE_TYPE_MAP: Record<string, string> = {
  'S-1000': 'ORGANIZATION',
  'S-1005': 'FARM',
  'S-1010': 'PAYROLL_RUBRICA',
  'S-1020': 'POSITION',
  'S-2200': 'EMPLOYEE',
  'S-2206': 'CONTRACT_AMENDMENT',
  'S-2230': 'EMPLOYEE_ABSENCE',
  'S-2299': 'EMPLOYEE_TERMINATION',
  'S-1200': 'PAYROLL_RUN_ITEM',
  'S-1210': 'PAYROLL_RUN_ITEM',
  'S-1299': 'PAYROLL_RUN',
  'S-2210': 'EMPLOYEE_ABSENCE',
  'S-2220': 'MEDICAL_EXAM',
  'S-2240': 'EPI_DELIVERY',
};
