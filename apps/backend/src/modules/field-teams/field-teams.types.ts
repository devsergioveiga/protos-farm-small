export class FieldTeamError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FieldTeamError';
  }
}

export const FIELD_TEAM_TYPES = [
  'COLHEITA_MANUAL',
  'APLICACAO_DEFENSIVOS',
  'CAPINA_ROCAGEM',
  'VACINACAO_MANEJO',
  'MANUTENCAO_CERCAS',
  'PLANTIO_MANUAL',
  'COLHEITA_CAFE',
  'COLHEITA_LARANJA',
  'GENERICA',
] as const;

export const TEAM_TYPE_LABELS: Record<string, string> = {
  COLHEITA_MANUAL: 'Colheita manual',
  APLICACAO_DEFENSIVOS: 'Aplicação de defensivos',
  CAPINA_ROCAGEM: 'Capina/Roçagem',
  VACINACAO_MANEJO: 'Vacinação/Manejo',
  MANUTENCAO_CERCAS: 'Manutenção de cercas',
  PLANTIO_MANUAL: 'Plantio manual',
  COLHEITA_CAFE: 'Colheita de café',
  COLHEITA_LARANJA: 'Colheita de laranja',
  GENERICA: 'Genérica',
};

export interface CreateFieldTeamInput {
  name: string;
  teamType: string;
  isTemporary?: boolean;
  leaderId: string;
  costCenterId?: string | null;
  memberIds?: string[];
  notes?: string | null;
}

export interface FieldTeamMemberItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: string;
  leftAt: string | null;
}

export interface FieldTeamItem {
  id: string;
  farmId: string;
  name: string;
  teamType: string;
  teamTypeLabel: string;
  isTemporary: boolean;
  leaderId: string;
  leaderName: string;
  costCenterId: string | null;
  costCenterName: string | null;
  costCenterCode: string | null;
  notes: string | null;
  memberCount: number;
  members: FieldTeamMemberItem[];
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
}
