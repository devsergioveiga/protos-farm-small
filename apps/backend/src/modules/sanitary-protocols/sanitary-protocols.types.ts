// ─── Error ──────────────────────────────────────────────────────────

export class SanitaryProtocolError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'SanitaryProtocolError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const PROCEDURE_TYPES = ['VACCINATION', 'DEWORMING', 'EXAM', 'MEDICATION', 'OTHER'] as const;

export const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  VACCINATION: 'Vacinação',
  DEWORMING: 'Vermifugação',
  EXAM: 'Exame',
  MEDICATION: 'Aplicação de medicamento',
  OTHER: 'Outro',
};

export const TRIGGER_TYPES = ['AGE', 'EVENT', 'CALENDAR'] as const;

export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  AGE: 'Por idade',
  EVENT: 'Por evento',
  CALENDAR: 'Por calendário',
};

export const EVENT_TRIGGERS = [
  'BIRTH',
  'WEANING',
  'REPRODUCTIVE_RELEASE',
  'PRE_IATF',
  'DRYING',
  'PRE_PARTUM',
  'POST_PARTUM',
  'TRANSITION',
  'FARM_ENTRY',
  'FARM_EXIT',
] as const;

export const EVENT_TRIGGER_LABELS: Record<string, string> = {
  BIRTH: 'Nascimento',
  WEANING: 'Desmama/Desaleitamento',
  REPRODUCTIVE_RELEASE: 'Liberação reprodutiva',
  PRE_IATF: 'Pré-IATF',
  DRYING: 'Secagem',
  PRE_PARTUM: 'Pré-parto',
  POST_PARTUM: 'Pós-parto',
  TRANSITION: 'Transição',
  FARM_ENTRY: 'Entrada na fazenda',
  FARM_EXIT: 'Saída da fazenda',
};

export const CALENDAR_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL'] as const;

export const CALENDAR_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'Mensal',
  QUARTERLY: 'Quadrimestral',
  BIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

export const SANITARY_PROTOCOL_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export const SANITARY_PROTOCOL_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

export const TARGET_CATEGORIES = [
  'BEZERRO',
  'BEZERRA',
  'NOVILHA',
  'NOVILHO',
  'VACA_LACTACAO',
  'VACA_SECA',
  'TOURO_REPRODUTOR',
  'DESCARTE',
] as const;

export const TARGET_CATEGORY_LABELS: Record<string, string> = {
  BEZERRO: 'Bezerro',
  BEZERRA: 'Bezerra',
  NOVILHA: 'Novilha',
  NOVILHO: 'Novilho',
  VACA_LACTACAO: 'Vaca em lactação',
  VACA_SECA: 'Vaca seca',
  TOURO_REPRODUTOR: 'Touro reprodutor',
  DESCARTE: 'Descarte',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface ItemInput {
  order: number;
  procedureType: string;
  productId?: string | null;
  productName: string;
  dosage?: number | null;
  dosageUnit?: string | null;
  administrationRoute?: string | null;
  triggerType: string;
  triggerAgeDays?: number | null;
  triggerAgeMaxDays?: number | null;
  triggerEvent?: string | null;
  triggerEventOffsetDays?: number | null;
  calendarFrequency?: string | null;
  calendarMonths?: number[] | null;
  isReinforcement?: boolean;
  reinforcementIntervalDays?: number | null;
  reinforcementDoseNumber?: number | null;
  withdrawalMeatDays?: number | null;
  withdrawalMilkDays?: number | null;
  notes?: string | null;
}

export interface CreateSanitaryProtocolInput {
  name: string;
  description?: string | null;
  authorName: string;
  status?: string;
  isObligatory?: boolean;
  targetCategories?: string[];
  items: ItemInput[];
}

export interface UpdateSanitaryProtocolInput {
  name?: string;
  description?: string | null;
  authorName?: string;
  status?: string;
  isObligatory?: boolean;
  targetCategories?: string[];
  items?: ItemInput[];
  versionReason?: string;
}

export interface ListSanitaryProtocolsQuery {
  page?: number;
  limit?: number;
  status?: string;
  procedureType?: string;
  targetCategory?: string;
  search?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface ProtocolItemResponse {
  id: string;
  order: number;
  procedureType: string;
  procedureTypeLabel: string;
  productId: string | null;
  productName: string;
  dosage: number | null;
  dosageUnit: string | null;
  dosageUnitLabel: string | null;
  administrationRoute: string | null;
  administrationRouteLabel: string | null;
  triggerType: string;
  triggerTypeLabel: string;
  triggerAgeDays: number | null;
  triggerAgeMaxDays: number | null;
  triggerEvent: string | null;
  triggerEventLabel: string | null;
  triggerEventOffsetDays: number | null;
  calendarFrequency: string | null;
  calendarFrequencyLabel: string | null;
  calendarMonths: number[];
  isReinforcement: boolean;
  reinforcementIntervalDays: number | null;
  reinforcementDoseNumber: number | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  notes: string | null;
}

export interface SanitaryProtocolResponse {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  authorName: string;
  status: string;
  statusLabel: string;
  version: number;
  originalId: string | null;
  isObligatory: boolean;
  targetCategories: string[];
  targetCategoryLabels: string[];
  items: ProtocolItemResponse[];
  createdAt: string;
  updatedAt: string;
}

// ─── Alert Types (CA12) ──────────────────────────────────────────────

export type AlertUrgency = 'OVERDUE' | 'DUE_7_DAYS' | 'DUE_15_DAYS' | 'DUE_30_DAYS';

export const ALERT_URGENCY_LABELS: Record<AlertUrgency, string> = {
  OVERDUE: 'Atrasado',
  DUE_7_DAYS: 'Próximos 7 dias',
  DUE_15_DAYS: 'Próximos 15 dias',
  DUE_30_DAYS: 'Próximos 30 dias',
};

export interface SanitaryAlertItem {
  protocolId: string;
  protocolName: string;
  protocolItemId: string;
  procedureType: string;
  procedureTypeLabel: string;
  productName: string;
  triggerType: string;
  triggerTypeLabel: string;
  urgency: AlertUrgency;
  urgencyLabel: string;
  isObligatory: boolean;
  targetCategories: string[];
  targetCategoryLabels: string[];
  /** For AGE triggers: number of matching animals */
  animalCount: number;
  /** For AGE triggers: list of sample animals (first 5) */
  sampleAnimals: {
    id: string;
    earTag: string;
    name: string | null;
    farmName: string;
    ageDays: number;
  }[];
  /** For CALENDAR triggers: the target month(s) */
  calendarMonths: number[];
  /** Estimated due date or period description */
  dueDescription: string;
  dosage: number | null;
  dosageUnit: string | null;
  dosageUnitLabel: string | null;
  administrationRoute: string | null;
  administrationRouteLabel: string | null;
  notes: string | null;
}

export interface SanitaryAlertsResponse {
  summary: {
    overdue: number;
    due7Days: number;
    due15Days: number;
    due30Days: number;
    total: number;
  };
  alerts: SanitaryAlertItem[];
}

export interface SanitaryAlertsQuery {
  farmId?: string;
  daysAhead?: number;
  urgency?: AlertUrgency;
  procedureType?: string;
  targetCategory?: string;
}

// ─── Seed Data (CA8, CA9, CA10) ─────────────────────────────────────

export interface SeedSanitaryProtocol {
  name: string;
  description: string;
  authorName: string;
  isObligatory: boolean;
  targetCategories: string[];
  items: Omit<ItemInput, 'productId'>[];
}

export const SEED_SANITARY_PROTOCOLS: SeedSanitaryProtocol[] = [
  // ─── Bezerras (0-12 meses) — CA8 ─────────────────────────────────
  {
    name: 'Protocolo Vacinal Bezerras (0-12 meses)',
    description:
      'Vacinações essenciais para bezerras: clostridioses, raiva, IBR/BVD e brucelose conforme faixa etária.',
    authorName: 'Veterinário responsável',
    isObligatory: false,
    targetCategories: ['BEZERRA'],
    items: [
      {
        order: 1,
        procedureType: 'VACCINATION',
        productName: 'Vacina polivalente clostridioses',
        dosage: 5,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'AGE',
        triggerAgeDays: 120,
        isReinforcement: false,
        notes: '1ª dose aos 4 meses de idade',
      },
      {
        order: 2,
        procedureType: 'VACCINATION',
        productName: 'Vacina polivalente clostridioses',
        dosage: 5,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'AGE',
        triggerAgeDays: 150,
        isReinforcement: true,
        reinforcementIntervalDays: 30,
        reinforcementDoseNumber: 2,
        notes: 'Reforço 30 dias após 1ª dose',
      },
      {
        order: 3,
        procedureType: 'VACCINATION',
        productName: 'Vacina antirrábica',
        dosage: 2,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'IM',
        triggerType: 'AGE',
        triggerAgeDays: 120,
        isReinforcement: false,
        notes: '1ª dose a partir de 4 meses',
      },
      {
        order: 4,
        procedureType: 'VACCINATION',
        productName: 'Vacina IBR/BVD',
        dosage: 5,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'AGE',
        triggerAgeDays: 180,
        isReinforcement: false,
        notes: '1ª dose aos 6 meses',
      },
      {
        order: 5,
        procedureType: 'VACCINATION',
        productName: 'Vacina IBR/BVD',
        dosage: 5,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'AGE',
        triggerAgeDays: 210,
        isReinforcement: true,
        reinforcementIntervalDays: 30,
        reinforcementDoseNumber: 2,
        notes: 'Reforço 30 dias após 1ª dose',
      },
      {
        order: 6,
        procedureType: 'VACCINATION',
        productName: 'Vacina B19 (brucelose)',
        dosage: 2,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'AGE',
        triggerAgeDays: 90,
        triggerAgeMaxDays: 240,
        isReinforcement: false,
        notes: 'Fêmeas entre 3-8 meses. Dose única obrigatória (MAPA)',
      },
    ],
  },

  // ─── Novilhas — CA8 ───────────────────────────────────────────────
  {
    name: 'Protocolo Sanitário Novilhas',
    description: 'Reforço anual de vacinas e preparação pré-IATF para novilhas.',
    authorName: 'Veterinário responsável',
    isObligatory: false,
    targetCategories: ['NOVILHA'],
    items: [
      {
        order: 1,
        procedureType: 'VACCINATION',
        productName: 'Vacina polivalente clostridioses',
        dosage: 5,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'CALENDAR',
        calendarFrequency: 'ANNUAL',
        isReinforcement: true,
        reinforcementDoseNumber: 3,
        notes: 'Revacinação anual',
      },
      {
        order: 2,
        procedureType: 'VACCINATION',
        productName: 'Vacina antirrábica',
        dosage: 2,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'IM',
        triggerType: 'CALENDAR',
        calendarFrequency: 'ANNUAL',
        isReinforcement: true,
        notes: 'Revacinação anual',
      },
      {
        order: 3,
        procedureType: 'VACCINATION',
        productName: 'Vacina IBR/BVD/Leptospirose',
        dosage: 5,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'EVENT',
        triggerEvent: 'PRE_IATF',
        triggerEventOffsetDays: -30,
        isReinforcement: false,
        notes: '30 dias antes da IATF',
      },
      {
        order: 4,
        procedureType: 'DEWORMING',
        productName: 'Ivermectina 1%',
        dosage: 1,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'EVENT',
        triggerEvent: 'PRE_IATF',
        triggerEventOffsetDays: -30,
        isReinforcement: false,
        withdrawalMeatDays: 35,
        notes: 'Vermifugação pré-IATF',
      },
    ],
  },

  // ─── Vacas — Pré-Secagem (CA9) ────────────────────────────────────
  {
    name: 'Protocolo de Secagem',
    description:
      'Protocolo sanitário de secagem: antibiótico intramamário, selante de teto, vermifugação e vacina mastite.',
    authorName: 'Veterinário responsável',
    isObligatory: false,
    targetCategories: ['VACA_LACTACAO'],
    items: [
      {
        order: 1,
        procedureType: 'MEDICATION',
        productName: 'Antibiótico intramamário (secagem)',
        dosage: 1,
        dosageUnit: 'FIXED_DOSE',
        administrationRoute: 'INTRAMMARY',
        triggerType: 'EVENT',
        triggerEvent: 'DRYING',
        isReinforcement: false,
        withdrawalMeatDays: 28,
        notes: 'Aplicar em todos os tetos após última ordenha',
      },
      {
        order: 2,
        procedureType: 'MEDICATION',
        productName: 'Selante de teto (bismuto)',
        dosage: 1,
        dosageUnit: 'FIXED_DOSE',
        administrationRoute: 'INTRAMMARY',
        triggerType: 'EVENT',
        triggerEvent: 'DRYING',
        isReinforcement: false,
        notes: 'Aplicar imediatamente após o antibiótico intramamário',
      },
      {
        order: 3,
        procedureType: 'DEWORMING',
        productName: 'Ivermectina 3.15% LA',
        dosage: 1,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'EVENT',
        triggerEvent: 'DRYING',
        isReinforcement: false,
        withdrawalMeatDays: 42,
        withdrawalMilkDays: 0,
        notes: 'Vermifugação pré-secagem com longa ação',
      },
      {
        order: 4,
        procedureType: 'VACCINATION',
        productName: 'Vacina J5/mastite',
        dosage: 5,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'EVENT',
        triggerEvent: 'DRYING',
        isReinforcement: false,
        notes: 'Vacina contra coliformes para prevenção de mastite no pós-parto',
      },
    ],
  },

  // ─── Vacas — Pós-Parto ────────────────────────────────────────────
  {
    name: 'Protocolo Pós-Parto',
    description: 'Manejo sanitário pós-parto: vermifugação, vitamina ADE e monitoramento.',
    authorName: 'Veterinário responsável',
    isObligatory: false,
    targetCategories: ['VACA_LACTACAO'],
    items: [
      {
        order: 1,
        procedureType: 'DEWORMING',
        productName: 'Albendazol 10%',
        dosage: 10,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'ORAL',
        triggerType: 'EVENT',
        triggerEvent: 'POST_PARTUM',
        triggerEventOffsetDays: 3,
        isReinforcement: false,
        withdrawalMilkDays: 4,
        notes: 'Vermifugação 3 dias pós-parto',
      },
      {
        order: 2,
        procedureType: 'MEDICATION',
        productName: 'Vitamina ADE injetável',
        dosage: 10,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'IM',
        triggerType: 'EVENT',
        triggerEvent: 'POST_PARTUM',
        triggerEventOffsetDays: 1,
        isReinforcement: false,
        notes: 'Suporte vitamínico pós-parto',
      },
    ],
  },

  // ─── Vacas — Transição (CA10) ─────────────────────────────────────
  {
    name: 'Protocolo de Transição',
    description:
      'Manejo sanitário do período de transição (21 dias pré-parto a 21 dias pós-parto): drench, cálcio, monitoramento cetose, vitaminas.',
    authorName: 'Veterinário responsável',
    isObligatory: false,
    targetCategories: ['VACA_SECA', 'VACA_LACTACAO'],
    items: [
      {
        order: 1,
        procedureType: 'MEDICATION',
        productName: 'Drench energético pós-parto',
        dosage: 20000,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'ORAL',
        triggerType: 'EVENT',
        triggerEvent: 'POST_PARTUM',
        triggerEventOffsetDays: 0,
        isReinforcement: false,
        notes: 'Administrar drench nas primeiras horas pós-parto (propileno glicol + eletrólitos)',
      },
      {
        order: 2,
        procedureType: 'MEDICATION',
        productName: 'Cálcio oral em gel/bolus',
        dosage: 1,
        dosageUnit: 'FIXED_DOSE',
        administrationRoute: 'ORAL',
        triggerType: 'EVENT',
        triggerEvent: 'POST_PARTUM',
        triggerEventOffsetDays: 0,
        isReinforcement: false,
        notes: 'Suplementação de cálcio imediata pós-parto. Repetir 12h depois.',
      },
      {
        order: 3,
        procedureType: 'EXAM',
        productName: 'Teste BHB (cetose)',
        dosage: null,
        dosageUnit: null,
        administrationRoute: null,
        triggerType: 'EVENT',
        triggerEvent: 'POST_PARTUM',
        triggerEventOffsetDays: 5,
        isReinforcement: false,
        notes: 'Monitoramento de cetose (BHB sérico ou leite) entre 5-14 dias pós-parto',
      },
      {
        order: 4,
        procedureType: 'MEDICATION',
        productName: 'Vitamina E + Selênio',
        dosage: 10,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'IM',
        triggerType: 'EVENT',
        triggerEvent: 'PRE_PARTUM',
        triggerEventOffsetDays: -21,
        isReinforcement: false,
        notes: '21 dias antes do parto previsto — suporte imunológico',
      },
    ],
  },

  // ─── Todo Rebanho — Aftosa (CA8, CA13) ────────────────────────────
  {
    name: 'Vacinação contra Febre Aftosa',
    description:
      'Vacinação obrigatória contra febre aftosa conforme calendário oficial estadual (maio e novembro).',
    authorName: 'Veterinário responsável',
    isObligatory: true,
    targetCategories: [
      'BEZERRO',
      'BEZERRA',
      'NOVILHA',
      'NOVILHO',
      'VACA_LACTACAO',
      'VACA_SECA',
      'TOURO_REPRODUTOR',
    ],
    items: [
      {
        order: 1,
        procedureType: 'VACCINATION',
        productName: 'Vacina contra febre aftosa',
        dosage: 5,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'CALENDAR',
        calendarFrequency: 'BIANNUAL',
        calendarMonths: [5, 11],
        isReinforcement: false,
        notes: 'Campanha maio e novembro. Obrigatório MAPA. Declarar no e-Sisbov.',
      },
    ],
  },

  // ─── Todo Rebanho — Raiva (CA8) ───────────────────────────────────
  {
    name: 'Vacinação Antirrábica Rebanho',
    description: 'Vacinação anual contra raiva para todo o rebanho.',
    authorName: 'Veterinário responsável',
    isObligatory: true,
    targetCategories: [
      'BEZERRO',
      'BEZERRA',
      'NOVILHA',
      'NOVILHO',
      'VACA_LACTACAO',
      'VACA_SECA',
      'TOURO_REPRODUTOR',
    ],
    items: [
      {
        order: 1,
        procedureType: 'VACCINATION',
        productName: 'Vacina antirrábica',
        dosage: 2,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'IM',
        triggerType: 'CALENDAR',
        calendarFrequency: 'ANNUAL',
        isReinforcement: false,
        notes: 'Vacinação anual. Obrigatória em áreas endêmicas.',
      },
    ],
  },

  // ─── Brucelose — Obrigatório (CA8, CA13) ──────────────────────────
  {
    name: 'Vacinação contra Brucelose (B19)',
    description:
      'Vacinação obrigatória de fêmeas entre 3 e 8 meses contra brucelose (Brucella abortus). Dose única.',
    authorName: 'Veterinário responsável',
    isObligatory: true,
    targetCategories: ['BEZERRA'],
    items: [
      {
        order: 1,
        procedureType: 'VACCINATION',
        productName: 'Vacina B19 (brucelose)',
        dosage: 2,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'AGE',
        triggerAgeDays: 90,
        triggerAgeMaxDays: 240,
        isReinforcement: false,
        notes: 'Dose única obrigatória MAPA (PNCEBT). Apenas fêmeas. Veterinário habilitado.',
      },
    ],
  },
];
