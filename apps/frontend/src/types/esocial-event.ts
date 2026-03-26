export type EsocialGroup = 'TABELA' | 'NAO_PERIODICO' | 'PERIODICO' | 'SST';
export type EsocialStatus = 'PENDENTE' | 'EXPORTADO' | 'ACEITO' | 'REJEITADO';

export interface EsocialValidationError {
  field: string;
  employeeName?: string;
  message: string;
}

export interface EsocialEvent {
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

export interface EsocialDashboard {
  referenceMonth: string;
  total: number;
  pendente: number;
  exportado: number;
  aceito: number;
  rejeitado: number;
  byGroup: Record<EsocialGroup, { total: number; pendente: number; exportado: number; aceito: number; rejeitado: number }>;
}

export interface UpdateEsocialStatusInput {
  status: 'ACEITO' | 'REJEITADO';
  rejectionReason?: string;
}

export const ESOCIAL_GROUP_LABELS: Record<EsocialGroup, string> = {
  TABELA: 'Tabela',
  NAO_PERIODICO: 'Nao Periodicos',
  PERIODICO: 'Periodicos',
  SST: 'SST',
};

export const ESOCIAL_STATUS_LABELS: Record<EsocialStatus, string> = {
  PENDENTE: 'Pendente',
  EXPORTADO: 'Exportado',
  ACEITO: 'Aceito',
  REJEITADO: 'Rejeitado',
};

export const ESOCIAL_EVENT_TYPE_LABELS: Record<string, string> = {
  'S-1000': 'Info Empregador',
  'S-1005': 'Tab Estabelecimentos',
  'S-1010': 'Tab Rubricas',
  'S-1020': 'Tab Lotacoes',
  'S-2200': 'Admissao',
  'S-2206': 'Alt. Contratual',
  'S-2230': 'Afastamento',
  'S-2299': 'Desligamento',
  'S-1200': 'Remuneracao',
  'S-1210': 'Pagamentos',
  'S-1299': 'Fechamento',
  'S-2210': 'CAT',
  'S-2220': 'Monitoramento',
  'S-2240': 'Exp. Risco',
};
