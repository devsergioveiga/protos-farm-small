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
  lifecycle: string | null;
  symptoms: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PestsResponse {
  data: PestItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreatePestInput {
  commonName: string;
  scientificName?: string | null;
  category: string;
  affectedCrops?: string[];
  severity?: string | null;
  ndeDescription?: string | null;
  ncDescription?: string | null;
  lifecycle?: string | null;
  symptoms?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export const PEST_CATEGORIES = [
  { value: 'INSETO', label: 'Inseto' },
  { value: 'ACARO', label: 'Ácaro' },
  { value: 'FUNGO', label: 'Fungo' },
  { value: 'BACTERIA', label: 'Bactéria' },
  { value: 'VIRUS', label: 'Vírus' },
  { value: 'NEMATOIDE', label: 'Nematóide' },
  { value: 'PLANTA_DANINHA', label: 'Planta daninha' },
  { value: 'OUTRO', label: 'Outro' },
] as const;

export const PEST_SEVERITIES = [
  { value: 'BAIXO', label: 'Baixo' },
  { value: 'MEDIO', label: 'Médio' },
  { value: 'ALTO', label: 'Alto' },
  { value: 'CRITICO', label: 'Crítico' },
] as const;

export const CROP_OPTIONS_PEST = [
  'Soja',
  'Milho',
  'Café',
  'Feijão',
  'Algodão',
  'Cana-de-açúcar',
  'Trigo',
  'Arroz',
  'Sorgo',
  'Pastagem',
] as const;
