export type KanbanColumnId =
  | 'RC_PENDENTE'
  | 'RC_APROVADA'
  | 'EM_COTACAO'
  | 'OC_EMITIDA'
  | 'AGUARDANDO_ENTREGA'
  | 'RECEBIDO'
  | 'PAGO';

export interface KanbanCard {
  id: string;
  entityType: 'RC' | 'SC' | 'OC' | 'GR' | 'PAYABLE';
  sequentialNumber: string;
  urgency?: 'NORMAL' | 'URGENTE' | 'EMERGENCIAL';
  requesterName: string;
  totalValue: number;
  daysInStage: number;
  isOverdue: boolean;
  farmId: string;
  farmName: string;
}

export interface KanbanColumn {
  id: KanbanColumnId;
  label: string;
  count: number;
  cards: KanbanCard[];
}

export type KanbanBoard = KanbanColumn[];

export interface KanbanFilters {
  farmId?: string;
  urgency?: string;
  search?: string;
}

// Valid DnD drop targets per source column
export const KANBAN_VALID_DROPS: Record<KanbanColumnId, KanbanColumnId[]> = {
  RC_PENDENTE: ['RC_APROVADA'],
  RC_APROVADA: ['EM_COTACAO'],
  EM_COTACAO: ['OC_EMITIDA'],
  OC_EMITIDA: ['AGUARDANDO_ENTREGA'],
  AGUARDANDO_ENTREGA: ['RECEBIDO'],
  RECEBIDO: [], // PAGO is automatic
  PAGO: [],
};
