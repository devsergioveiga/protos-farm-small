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
