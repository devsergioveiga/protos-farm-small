// ─── Error ──────────────────────────────────────────────────────────

export class PestError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PestError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const PEST_CATEGORIES = [
  'INSETO',
  'ACARO',
  'FUNGO',
  'BACTERIA',
  'VIRUS',
  'NEMATOIDE',
  'PLANTA_DANINHA',
  'OUTRO',
] as const;

export const PEST_CATEGORY_LABELS: Record<string, string> = {
  INSETO: 'Inseto',
  ACARO: 'Ácaro',
  FUNGO: 'Fungo',
  BACTERIA: 'Bactéria',
  VIRUS: 'Vírus',
  NEMATOIDE: 'Nematóide',
  PLANTA_DANINHA: 'Planta daninha',
  OUTRO: 'Outro',
};

export const PEST_SEVERITY_LEVELS = ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] as const;

export const PEST_SEVERITY_LABELS: Record<string, string> = {
  BAIXO: 'Baixo',
  MEDIO: 'Médio',
  ALTO: 'Alto',
  CRITICO: 'Crítico',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreatePestInput {
  commonName: string;
  scientificName?: string | null;
  category: string;
  affectedCrops?: string[];
  severity?: string | null;
  ndeDescription?: string | null;
  ncDescription?: string | null;
  controlThreshold?: string | null;
  recommendedProducts?: string | null;
  lifecycle?: string | null;
  symptoms?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export type UpdatePestInput = Partial<CreatePestInput>;

export interface ListPestsQuery {
  page?: number;
  limit?: number;
  category?: string;
  crop?: string;
  search?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface PestItem {
  id: string;
  organizationId: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  categoryLabel: string;
  affectedCrops: string[];
  severity: string | null;
  severityLabel: string | null;
  ndeDescription: string | null;
  ncDescription: string | null;
  controlThreshold: string | null;
  controlThresholdLabel: string | null;
  recommendedProducts: string | null;
  lifecycle: string | null;
  symptoms: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
