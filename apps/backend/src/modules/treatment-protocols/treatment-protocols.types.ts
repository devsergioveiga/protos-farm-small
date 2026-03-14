// ─── Error ──────────────────────────────────────────────────────────

export class TreatmentProtocolError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'TreatmentProtocolError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const ADMINISTRATION_ROUTES = ['IM', 'SC', 'IV', 'ORAL', 'INTRAMMARY', 'TOPICAL'] as const;

export const ADMINISTRATION_ROUTE_LABELS: Record<string, string> = {
  IM: 'Intramuscular',
  SC: 'Subcutâneo',
  IV: 'Intravenoso',
  ORAL: 'Oral',
  INTRAMMARY: 'Intramamária',
  TOPICAL: 'Tópica',
};

export const DOSAGE_UNITS = ['MG_KG', 'ML_ANIMAL', 'FIXED_DOSE'] as const;

export const DOSAGE_UNIT_LABELS: Record<string, string> = {
  MG_KG: 'mg/kg',
  ML_ANIMAL: 'mL/animal',
  FIXED_DOSE: 'Dose fixa',
};

export const PROTOCOL_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export const PROTOCOL_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface StepInput {
  order: number;
  productId?: string | null;
  productName: string;
  dosage: number;
  dosageUnit: string;
  administrationRoute: string;
  frequencyPerDay?: number;
  startDay?: number;
  durationDays: number;
  withdrawalMeatDays?: number | null;
  withdrawalMilkDays?: number | null;
  notes?: string | null;
}

export interface CreateProtocolInput {
  name: string;
  description?: string | null;
  notes?: string | null;
  severity?: string | null;
  authorName: string;
  status?: string;
  diseaseIds?: string[];
  steps: StepInput[];
}

export interface UpdateProtocolInput {
  name?: string;
  description?: string | null;
  notes?: string | null;
  severity?: string | null;
  authorName?: string;
  status?: string;
  diseaseIds?: string[];
  steps?: StepInput[];
  versionReason?: string;
}

export interface ListProtocolsQuery {
  page?: number;
  limit?: number;
  status?: string;
  diseaseId?: string;
  search?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface StepItem {
  id: string;
  order: number;
  productId: string | null;
  productName: string;
  dosage: number;
  dosageUnit: string;
  dosageUnitLabel: string;
  administrationRoute: string;
  administrationRouteLabel: string;
  frequencyPerDay: number;
  startDay: number;
  durationDays: number;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  notes: string | null;
}

export interface ProtocolDiseaseItem {
  id: string;
  diseaseId: string;
  diseaseName: string;
}

export interface ProtocolItem {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  notes: string | null;
  severity: string | null;
  severityLabel: string | null;
  authorName: string;
  status: string;
  statusLabel: string;
  version: number;
  originalId: string | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  estimatedCostCents: number | null;
  diseases: ProtocolDiseaseItem[];
  steps: StepItem[];
  createdAt: string;
  updatedAt: string;
}

// ─── Seed Data ─────────────────────────────────────────────────────

export interface SeedProtocol {
  name: string;
  description: string;
  severity: string;
  authorName: string;
  diseaseNames: string[];
  steps: Omit<StepInput, 'productId'>[];
}

export const SEED_PROTOCOLS: SeedProtocol[] = [
  {
    name: 'Mastite clínica grau 1 — cefalosporina',
    description:
      'Tratamento intramamário para mastite clínica leve, protocolo padrão com cefalosporina.',
    severity: 'MILD',
    authorName: 'Veterinário responsável',
    diseaseNames: ['Mastite clínica'],
    steps: [
      {
        order: 1,
        productName: 'Cefalosporina intramamária',
        dosage: 1,
        dosageUnit: 'FIXED_DOSE',
        administrationRoute: 'INTRAMMARY',
        frequencyPerDay: 2,
        startDay: 1,
        durationDays: 3,
        withdrawalMeatDays: 4,
        withdrawalMilkDays: 96,
      },
    ],
  },
  {
    name: 'Mastite clínica grau 2 — sistêmica',
    description:
      'Tratamento sistêmico para mastite clínica moderada com antibiótico e anti-inflamatório.',
    severity: 'MODERATE',
    authorName: 'Veterinário responsável',
    diseaseNames: ['Mastite clínica'],
    steps: [
      {
        order: 1,
        productName: 'Ceftiofur',
        dosage: 1,
        dosageUnit: 'MG_KG',
        administrationRoute: 'IM',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 5,
        withdrawalMeatDays: 8,
        withdrawalMilkDays: 0,
      },
      {
        order: 2,
        productName: 'Flunixin meglumine',
        dosage: 2.2,
        dosageUnit: 'MG_KG',
        administrationRoute: 'IV',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 3,
        withdrawalMeatDays: 4,
        withdrawalMilkDays: 36,
      },
    ],
  },
  {
    name: 'Pneumonia — florfenicol',
    description: 'Protocolo para pneumonia bovina com florfenicol em dose única de longa ação.',
    severity: 'SEVERE',
    authorName: 'Veterinário responsável',
    diseaseNames: ['Pneumonia'],
    steps: [
      {
        order: 1,
        productName: 'Florfenicol LA',
        dosage: 40,
        dosageUnit: 'MG_KG',
        administrationRoute: 'IM',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 1,
        withdrawalMeatDays: 45,
        withdrawalMilkDays: null,
        notes: 'Dose única de longa ação. Repetir em 48h se necessário.',
      },
      {
        order: 2,
        productName: 'Meloxicam',
        dosage: 0.5,
        dosageUnit: 'MG_KG',
        administrationRoute: 'SC',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 3,
        withdrawalMeatDays: 15,
        withdrawalMilkDays: 5,
      },
    ],
  },
  {
    name: 'Diarreia neonatal — suporte',
    description:
      'Protocolo de suporte para bezerros com diarreia neonatal: reidratação e antibiótico.',
    severity: 'SEVERE',
    authorName: 'Veterinário responsável',
    diseaseNames: ['Diarreia neonatal'],
    steps: [
      {
        order: 1,
        productName: 'Solução eletrolítica oral',
        dosage: 2000,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'ORAL',
        frequencyPerDay: 3,
        startDay: 1,
        durationDays: 3,
        withdrawalMeatDays: 0,
        withdrawalMilkDays: 0,
      },
      {
        order: 2,
        productName: 'Sulfadoxina + Trimetoprim',
        dosage: 15,
        dosageUnit: 'MG_KG',
        administrationRoute: 'IM',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 5,
        withdrawalMeatDays: 14,
        withdrawalMilkDays: 3,
      },
    ],
  },
  {
    name: 'Metrite — ceftiofur',
    description: 'Tratamento de metrite puerperal com antibiótico sistêmico e anti-inflamatório.',
    severity: 'MODERATE',
    authorName: 'Veterinário responsável',
    diseaseNames: ['Metrite'],
    steps: [
      {
        order: 1,
        productName: 'Ceftiofur',
        dosage: 2.2,
        dosageUnit: 'MG_KG',
        administrationRoute: 'SC',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 5,
        withdrawalMeatDays: 0,
        withdrawalMilkDays: 0,
      },
      {
        order: 2,
        productName: 'Flunixin meglumine',
        dosage: 2.2,
        dosageUnit: 'MG_KG',
        administrationRoute: 'IV',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 3,
        withdrawalMeatDays: 4,
        withdrawalMilkDays: 36,
      },
    ],
  },
  {
    name: 'Cetose — propileno glicol',
    description: 'Protocolo para cetose subclínica/clínica com propileno glicol oral e suporte.',
    severity: 'MODERATE',
    authorName: 'Veterinário responsável',
    diseaseNames: ['Cetose/Acetonemia'],
    steps: [
      {
        order: 1,
        productName: 'Propileno glicol',
        dosage: 300,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'ORAL',
        frequencyPerDay: 2,
        startDay: 1,
        durationDays: 5,
        withdrawalMeatDays: 0,
        withdrawalMilkDays: 0,
      },
    ],
  },
  {
    name: 'Hipocalcemia — cálcio IV',
    description: 'Tratamento de emergência para febre do leite com cálcio intravenoso.',
    severity: 'SEVERE',
    authorName: 'Veterinário responsável',
    diseaseNames: ['Hipocalcemia (febre do leite)'],
    steps: [
      {
        order: 1,
        productName: 'Gluconato de cálcio 23%',
        dosage: 500,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'IV',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 1,
        withdrawalMeatDays: 0,
        withdrawalMilkDays: 0,
        notes: 'Administrar lentamente (10-20 min). Monitorar frequência cardíaca.',
      },
      {
        order: 2,
        productName: 'Cálcio oral em gel',
        dosage: 1,
        dosageUnit: 'FIXED_DOSE',
        administrationRoute: 'ORAL',
        frequencyPerDay: 2,
        startDay: 2,
        durationDays: 2,
        withdrawalMeatDays: 0,
        withdrawalMilkDays: 0,
      },
    ],
  },
  {
    name: 'Laminite — anti-inflamatório + casqueamento',
    description: 'Protocolo para laminite/pododermatite com anti-inflamatório e cuidados podais.',
    severity: 'MODERATE',
    authorName: 'Veterinário responsável',
    diseaseNames: ['Laminite/Pododermatite'],
    steps: [
      {
        order: 1,
        productName: 'Meloxicam',
        dosage: 0.5,
        dosageUnit: 'MG_KG',
        administrationRoute: 'SC',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 5,
        withdrawalMeatDays: 15,
        withdrawalMilkDays: 5,
      },
      {
        order: 2,
        productName: 'Oxitetraciclina tópica (spray)',
        dosage: 1,
        dosageUnit: 'FIXED_DOSE',
        administrationRoute: 'TOPICAL',
        frequencyPerDay: 1,
        startDay: 1,
        durationDays: 7,
        withdrawalMeatDays: 0,
        withdrawalMilkDays: 0,
        notes: 'Aplicar após casqueamento corretivo e limpeza da lesão.',
      },
    ],
  },
];
