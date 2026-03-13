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

export interface FieldTeamsResponse {
  data: FieldTeamItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateFieldTeamInput {
  name: string;
  teamType: string;
  isTemporary?: boolean;
  leaderId: string;
  costCenterId?: string | null;
  memberIds?: string[];
  notes?: string | null;
}

export interface CostCenterItem {
  id: string;
  farmId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  teamCount: number;
  createdAt: string;
  updatedAt: string;
}

export const FIELD_TEAM_TYPES = [
  { value: 'COLHEITA_MANUAL', label: 'Colheita manual' },
  { value: 'APLICACAO_DEFENSIVOS', label: 'Aplicação de defensivos' },
  { value: 'CAPINA_ROCAGEM', label: 'Capina/Roçagem' },
  { value: 'VACINACAO_MANEJO', label: 'Vacinação/Manejo' },
  { value: 'MANUTENCAO_CERCAS', label: 'Manutenção de cercas' },
  { value: 'PLANTIO_MANUAL', label: 'Plantio manual' },
  { value: 'COLHEITA_CAFE', label: 'Colheita de café' },
  { value: 'COLHEITA_LARANJA', label: 'Colheita de laranja' },
  { value: 'GENERICA', label: 'Genérica' },
] as const;
