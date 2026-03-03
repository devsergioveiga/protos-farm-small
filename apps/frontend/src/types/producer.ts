import type { PaginationMeta } from './admin';

export type ProducerType = 'PF' | 'PJ' | 'SOCIEDADE_EM_COMUM';
export type ProducerStatus = 'ACTIVE' | 'INACTIVE';

export interface ProducerListItem {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  type: ProducerType;
  status: ProducerStatus;
  state: string | null;
  city: string | null;
  createdAt: string;
  _count: {
    farmLinks: number;
    stateRegistrations: number;
  };
}

export interface ProducersResponse {
  data: ProducerListItem[];
  meta: PaginationMeta;
}

// ─── Detail types ──────────────────────────────────────────────────

export interface SocietyParticipant {
  id: string;
  name: string;
  cpf: string | null;
  participationPct: number | null;
  isMainResponsible: boolean;
  createdAt: string;
}

export interface ProducerStateRegistration {
  id: string;
  number: string;
  state: string;
  cnaeActivity: string | null;
  assessmentRegime: string | null;
  category: string | null;
  inscriptionDate: string | null;
  situation: string | null;
  contractEndDate: string | null;
  milkProgramOptIn: boolean | null;
  isDefaultForFarm: boolean;
  farmId: string | null;
  createdAt: string;
}

export interface ProducerFarmLink {
  id: string;
  bondType: string;
  participationPct: number | null;
  startDate: string | null;
  endDate: string | null;
  isItrDeclarant: boolean;
  createdAt: string;
  farm: {
    id: string;
    name: string;
    nickname: string | null;
    state: string | null;
  };
}

export interface ProducerDetail {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  type: ProducerType;
  status: ProducerStatus;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  birthDate: string | null;
  spouseCpf: string | null;
  incraRegistration: string | null;
  legalRepresentative: string | null;
  legalRepCpf: string | null;
  taxRegime: string | null;
  mainCnae: string | null;
  ruralActivityType: string | null;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  participants: SocietyParticipant[];
  stateRegistrations: ProducerStateRegistration[];
  farmLinks: ProducerFarmLink[];
}

// ─── Create types ──────────────────────────────────────────────────

export interface CreateProducerPFPayload {
  type: 'PF';
  name: string;
  document: string;
  tradeName?: string;
  birthDate?: string;
  spouseCpf?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  incraRegistration?: string;
  legalRepresentative?: string;
  legalRepCpf?: string;
  taxRegime?: string;
}
