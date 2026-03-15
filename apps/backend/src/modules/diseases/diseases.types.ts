// ─── Error ──────────────────────────────────────────────────────────

export class DiseaseError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'DiseaseError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const DISEASE_CATEGORIES = [
  'INFECTIOUS',
  'METABOLIC',
  'REPRODUCTIVE',
  'LOCOMOTOR',
  'PARASITIC',
  'NUTRITIONAL',
  'OTHER',
] as const;

export const DISEASE_CATEGORY_LABELS: Record<string, string> = {
  INFECTIOUS: 'Infecciosa',
  METABOLIC: 'Metabólica',
  REPRODUCTIVE: 'Reprodutiva',
  LOCOMOTOR: 'Locomotora',
  PARASITIC: 'Parasitária',
  NUTRITIONAL: 'Nutricional',
  OTHER: 'Outra',
};

export const DISEASE_SEVERITY_LEVELS = ['MILD', 'MODERATE', 'SEVERE'] as const;

export const DISEASE_SEVERITY_LABELS: Record<string, string> = {
  MILD: 'Leve',
  MODERATE: 'Moderada',
  SEVERE: 'Grave',
};

export const AFFECTED_SYSTEMS = [
  'DIGESTIVE',
  'REPRODUCTIVE',
  'LOCOMOTOR',
  'MAMMARY',
  'RESPIRATORY',
  'SYSTEMIC',
] as const;

export const AFFECTED_SYSTEM_LABELS: Record<string, string> = {
  DIGESTIVE: 'Digestivo',
  REPRODUCTIVE: 'Reprodutivo',
  LOCOMOTOR: 'Locomotor',
  MAMMARY: 'Mamário',
  RESPIRATORY: 'Respiratório',
  SYSTEMIC: 'Sistêmico',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateDiseaseInput {
  name: string;
  scientificName?: string | null;
  code?: string | null;
  category: string;
  severity?: string | null;
  affectedSystem?: string | null;
  symptoms?: string | null;
  quarantineDays?: number | null;
  isNotifiable?: boolean;
  photoUrl?: string | null;
  notes?: string | null;
}

export type UpdateDiseaseInput = Partial<CreateDiseaseInput>;

export interface ListDiseasesQuery {
  page?: number;
  limit?: number;
  category?: string;
  severity?: string;
  isNotifiable?: boolean;
  search?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface DiseaseItem {
  id: string;
  organizationId: string;
  name: string;
  scientificName: string | null;
  code: string | null;
  category: string;
  categoryLabel: string;
  severity: string | null;
  severityLabel: string | null;
  affectedSystem: string | null;
  affectedSystemLabel: string | null;
  symptoms: string | null;
  quarantineDays: number | null;
  isNotifiable: boolean;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
