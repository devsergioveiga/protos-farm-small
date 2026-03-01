// ─── Error ──────────────────────────────────────────────────────────

export class ProducerError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ProducerError';
  }
}

// ─── Constants ──────────────────────────────────────────────────────

export const VALID_UF = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const;

export const PRODUCER_TYPES = ['PF', 'PJ', 'SOCIEDADE_EM_COMUM'] as const;
export const PRODUCER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const TAX_REGIMES = ['REAL', 'PRESUMIDO', 'SIMPLES', 'ISENTO'] as const;
export const IE_SITUATIONS = ['ACTIVE', 'SUSPENDED', 'CANCELLED'] as const;
export const IE_CATEGORIES = ['PRIMEIRO_ESTABELECIMENTO', 'DEMAIS', 'UNICO'] as const;
export const BOND_TYPES = [
  'PROPRIETARIO',
  'ARRENDATARIO',
  'COMODATARIO',
  'PARCEIRO',
  'MEEIRO',
  'USUFRUTUARIO',
  'CONDOMINO',
] as const;

// IE number: 8–14 digits
export const IE_NUMBER_REGEX = /^\d{8,14}$/;

// ─── Input types ────────────────────────────────────────────────────

export interface CreateProducerInput {
  type: string;
  name: string;
  tradeName?: string;
  document?: string;
  birthDate?: string;
  spouseCpf?: string;
  incraRegistration?: string;
  legalRepresentative?: string;
  legalRepCpf?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxRegime?: string;
  mainCnae?: string;
  ruralActivityType?: string;
}

export interface UpdateProducerInput {
  name?: string;
  tradeName?: string;
  document?: string;
  birthDate?: string;
  spouseCpf?: string;
  incraRegistration?: string;
  legalRepresentative?: string;
  legalRepCpf?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxRegime?: string;
  mainCnae?: string;
  ruralActivityType?: string;
}

export interface ListProducersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
}

export interface CreateParticipantInput {
  name: string;
  cpf: string;
  participationPct: number;
  isMainResponsible?: boolean;
}

export interface UpdateParticipantInput {
  name?: string;
  cpf?: string;
  participationPct?: number;
  isMainResponsible?: boolean;
}

export interface CreateIeInput {
  number: string;
  state: string;
  farmId?: string;
  cnaeActivity?: string;
  assessmentRegime?: string;
  category?: string;
  inscriptionDate?: string;
  situation?: string;
  contractEndDate?: string;
  milkProgramOptIn?: boolean;
  isDefaultForFarm?: boolean;
}

export interface UpdateIeInput {
  number?: string;
  state?: string;
  farmId?: string;
  cnaeActivity?: string;
  assessmentRegime?: string;
  category?: string;
  inscriptionDate?: string;
  situation?: string;
  contractEndDate?: string;
  milkProgramOptIn?: boolean;
  isDefaultForFarm?: boolean;
}

export interface CreateFarmLinkInput {
  farmId: string;
  bondType: string;
  participationPct?: number;
}

export interface UpdateFarmLinkInput {
  bondType?: string;
  participationPct?: number;
}
