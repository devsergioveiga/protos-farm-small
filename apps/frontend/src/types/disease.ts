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

export interface DiseasesResponse {
  data: DiseaseItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

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

export const DISEASE_CATEGORIES = [
  { value: 'INFECTIOUS', label: 'Infecciosa' },
  { value: 'METABOLIC', label: 'Metabólica' },
  { value: 'REPRODUCTIVE', label: 'Reprodutiva' },
  { value: 'LOCOMOTOR', label: 'Locomotora' },
  { value: 'PARASITIC', label: 'Parasitária' },
  { value: 'NUTRITIONAL', label: 'Nutricional' },
  { value: 'OTHER', label: 'Outra' },
] as const;

export const DISEASE_SEVERITIES = [
  { value: 'MILD', label: 'Leve' },
  { value: 'MODERATE', label: 'Moderada' },
  { value: 'SEVERE', label: 'Grave' },
] as const;

export const AFFECTED_SYSTEMS = [
  { value: 'DIGESTIVE', label: 'Digestivo' },
  { value: 'REPRODUCTIVE', label: 'Reprodutivo' },
  { value: 'LOCOMOTOR', label: 'Locomotor' },
  { value: 'MAMMARY', label: 'Mamário' },
  { value: 'RESPIRATORY', label: 'Respiratório' },
  { value: 'SYSTEMIC', label: 'Sistêmico' },
] as const;
