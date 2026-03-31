// ─── Error ──────────────────────────────────────────────────────────

export class IatfProtocolError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'IatfProtocolError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const TARGET_CATEGORIES = ['COWS', 'HEIFERS', 'BOTH'] as const;

export const TARGET_CATEGORY_LABELS: Record<string, string> = {
  COWS: 'Vacas',
  HEIFERS: 'Novilhas',
  BOTH: 'Ambos',
};

export const IATF_PROTOCOL_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export const IATF_PROTOCOL_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

export const DOSE_UNITS = ['mg', 'mL', 'UI'] as const;

export const DOSE_UNIT_LABELS: Record<string, string> = {
  mg: 'mg',
  mL: 'mL',
  UI: 'UI',
};

export const ADMIN_ROUTES = ['IM', 'SC', 'IV', 'INTRAVAGINAL', 'ORAL'] as const;

export const ADMIN_ROUTE_LABELS: Record<string, string> = {
  IM: 'Intramuscular',
  SC: 'Subcutâneo',
  IV: 'Intravenoso',
  INTRAVAGINAL: 'Intravaginal',
  ORAL: 'Oral',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface StepProductInput {
  productId?: string | null;
  productName: string;
  dose: number;
  doseUnit: string;
  administrationRoute?: string | null;
  notes?: string | null;
}

export interface StepInput {
  dayNumber: number;
  description: string;
  isAiDay?: boolean;
  sortOrder?: number;
  products: StepProductInput[];
}

export interface CreateProtocolInput {
  name: string;
  description?: string | null;
  targetCategory: string;
  veterinaryAuthor?: string | null;
  status?: string;
  notes?: string | null;
  steps: StepInput[];
}

export interface UpdateProtocolInput {
  name?: string;
  description?: string | null;
  targetCategory?: string;
  veterinaryAuthor?: string | null;
  status?: string;
  notes?: string | null;
  steps?: StepInput[];
  /** true = cria nova versão (padrão); false = corrige in-place */
  createNewVersion?: boolean;
}

export interface ListProtocolsQuery {
  page?: number;
  limit?: number;
  status?: string;
  targetCategory?: string;
  search?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface StepProductItem {
  id: string;
  productId: string | null;
  productName: string;
  dose: number;
  doseUnit: string;
  doseUnitLabel: string;
  administrationRoute: string | null;
  administrationRouteLabel: string | null;
  notes: string | null;
}

export interface StepItem {
  id: string;
  dayNumber: number;
  dayLabel: string;
  description: string;
  isAiDay: boolean;
  sortOrder: number;
  products: StepProductItem[];
}

export interface IatfProtocolItem {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  targetCategory: string;
  targetCategoryLabel: string;
  veterinaryAuthor: string | null;
  status: string;
  statusLabel: string;
  version: number;
  parentId: string | null;
  estimatedCostCents: number;
  notes: string | null;
  createdBy: string;
  steps: StepItem[];
  createdAt: string;
  updatedAt: string;
}

// ─── Seed Data ─────────────────────────────────────────────────────

export interface SeedIatfProtocol {
  name: string;
  description: string;
  targetCategory: string;
  veterinaryAuthor: string;
  steps: StepInput[];
}

export const SEED_IATF_PROTOCOLS: SeedIatfProtocol[] = [
  {
    name: 'Ovsynch',
    description:
      'Protocolo Ovsynch clássico para sincronização de ovulação em vacas lactantes. Usa GnRH + PGF2α + GnRH com IA em tempo fixo.',
    targetCategory: 'COWS',
    veterinaryAuthor: 'Veterinário responsável',
    steps: [
      {
        dayNumber: 0,
        description: 'Aplicação de GnRH para recrutamento folicular',
        isAiDay: false,
        sortOrder: 0,
        products: [
          {
            productName: 'GnRH (Gonadorelina)',
            dose: 100,
            doseUnit: 'UI',
            administrationRoute: 'IM',
          },
        ],
      },
      {
        dayNumber: 7,
        description: 'Aplicação de PGF2α para luteólise',
        isAiDay: false,
        sortOrder: 0,
        products: [
          {
            productName: 'PGF2α (Cloprostenol)',
            dose: 0.5,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
        ],
      },
      {
        dayNumber: 9,
        description: 'Aplicação de GnRH + Inseminação artificial',
        isAiDay: true,
        sortOrder: 0,
        products: [
          {
            productName: 'GnRH (Gonadorelina)',
            dose: 100,
            doseUnit: 'UI',
            administrationRoute: 'IM',
          },
        ],
      },
    ],
  },
  {
    name: 'P4 + BE padrão',
    description:
      'Protocolo convencional com implante de progesterona (P4) e benzoato de estradiol (BE) para vacas e novilhas.',
    targetCategory: 'BOTH',
    veterinaryAuthor: 'Veterinário responsável',
    steps: [
      {
        dayNumber: 0,
        description: 'Inserção do implante de P4 + aplicação de BE',
        isAiDay: false,
        sortOrder: 0,
        products: [
          {
            productName: 'Implante de progesterona (P4)',
            dose: 1,
            doseUnit: 'UI',
            administrationRoute: 'INTRAVAGINAL',
          },
          {
            productName: 'Benzoato de estradiol (BE)',
            dose: 2,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
        ],
      },
      {
        dayNumber: 8,
        description: 'Remoção do implante de P4 + PGF2α + eCG + cipionato de estradiol',
        isAiDay: false,
        sortOrder: 0,
        products: [
          {
            productName: 'PGF2α (Cloprostenol)',
            dose: 0.5,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
          {
            productName: 'eCG (Gonadotrofina coriônica equina)',
            dose: 300,
            doseUnit: 'UI',
            administrationRoute: 'IM',
          },
          {
            productName: 'Cipionato de estradiol (CE)',
            dose: 1,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
        ],
      },
      {
        dayNumber: 10,
        description: 'Inseminação artificial em tempo fixo',
        isAiDay: true,
        sortOrder: 0,
        products: [],
      },
    ],
  },
  {
    name: 'Protocolo novilhas',
    description:
      'Protocolo de IATF otimizado para novilhas, com P4 e doses ajustadas para categoria jovem.',
    targetCategory: 'HEIFERS',
    veterinaryAuthor: 'Veterinário responsável',
    steps: [
      {
        dayNumber: 0,
        description: 'Inserção do implante de P4 + aplicação de BE',
        isAiDay: false,
        sortOrder: 0,
        products: [
          {
            productName: 'Implante de progesterona (P4)',
            dose: 1,
            doseUnit: 'UI',
            administrationRoute: 'INTRAVAGINAL',
          },
          {
            productName: 'Benzoato de estradiol (BE)',
            dose: 2,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
        ],
      },
      {
        dayNumber: 8,
        description: 'Remoção do implante de P4 + PGF2α + cipionato de estradiol',
        isAiDay: false,
        sortOrder: 0,
        products: [
          {
            productName: 'PGF2α (Cloprostenol)',
            dose: 0.5,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
          {
            productName: 'Cipionato de estradiol (CE)',
            dose: 0.5,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
        ],
      },
      {
        dayNumber: 10,
        description: 'Inseminação artificial em tempo fixo',
        isAiDay: true,
        sortOrder: 0,
        products: [],
      },
    ],
  },
  {
    name: 'Protocolo vaca lactante',
    description:
      'Protocolo de IATF para vacas em lactação, com eCG para melhor resposta folicular em animais com balanço energético negativo.',
    targetCategory: 'COWS',
    veterinaryAuthor: 'Veterinário responsável',
    steps: [
      {
        dayNumber: 0,
        description: 'Inserção do implante de P4 + aplicação de BE',
        isAiDay: false,
        sortOrder: 0,
        products: [
          {
            productName: 'Implante de progesterona (P4)',
            dose: 1,
            doseUnit: 'UI',
            administrationRoute: 'INTRAVAGINAL',
          },
          {
            productName: 'Benzoato de estradiol (BE)',
            dose: 2,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
        ],
      },
      {
        dayNumber: 8,
        description: 'Remoção do implante de P4 + PGF2α + eCG + cipionato de estradiol',
        isAiDay: false,
        sortOrder: 0,
        products: [
          {
            productName: 'PGF2α (Cloprostenol)',
            dose: 0.5,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
          {
            productName: 'eCG (Gonadotrofina coriônica equina)',
            dose: 400,
            doseUnit: 'UI',
            administrationRoute: 'IM',
          },
          {
            productName: 'Cipionato de estradiol (CE)',
            dose: 1,
            doseUnit: 'mg',
            administrationRoute: 'IM',
          },
        ],
      },
      {
        dayNumber: 10,
        description: 'Inseminação artificial em tempo fixo + GnRH',
        isAiDay: true,
        sortOrder: 0,
        products: [
          {
            productName: 'GnRH (Gonadorelina)',
            dose: 100,
            doseUnit: 'UI',
            administrationRoute: 'IM',
          },
        ],
      },
    ],
  },
];
