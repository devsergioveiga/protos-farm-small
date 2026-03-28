export type AnimalExitType = 'MORTE' | 'VENDA' | 'DOACAO' | 'ABATE' | 'TRANSFERENCIA' | 'PERDA';

export const EXIT_TYPE_LABELS: Record<AnimalExitType, string> = {
  MORTE: 'Morte',
  VENDA: 'Venda',
  DOACAO: 'Doação',
  ABATE: 'Abate',
  TRANSFERENCIA: 'Transferência',
  PERDA: 'Perda',
};

export const EXIT_TYPES: AnimalExitType[] = [
  'MORTE',
  'VENDA',
  'DOACAO',
  'ABATE',
  'TRANSFERENCIA',
  'PERDA',
];

export type DeathType = 'NATURAL' | 'ACIDENTE' | 'DOENCA' | 'PREDADOR' | 'DESCONHECIDA';

export const DEATH_TYPE_LABELS: Record<DeathType, string> = {
  NATURAL: 'Natural',
  ACIDENTE: 'Acidente',
  DOENCA: 'Doença',
  PREDADOR: 'Predador',
  DESCONHECIDA: 'Desconhecida',
};

export const DEATH_TYPES: DeathType[] = [
  'NATURAL',
  'ACIDENTE',
  'DOENCA',
  'PREDADOR',
  'DESCONHECIDA',
];

export interface AnimalExitItem {
  id: string;
  animalId: string;
  farmId: string;
  animalEarTag: string;
  animalName: string | null;
  exitType: AnimalExitType;
  exitTypeLabel: string;
  exitDate: string;
  deathType: string | null;
  deathTypeLabel: string | null;
  deathCause: string | null;
  buyerName: string | null;
  salePriceTotal: number | null;
  salePricePerKg: number | null;
  saleWeightKg: number | null;
  gtaNumber: string | null;
  destinationFarm: string | null;
  notes: string | null;
  createdBy: string;
  creatorName: string;
  createdAt: string;
}

export interface CreateAnimalExitPayload {
  exitType: AnimalExitType;
  exitDate: string;
  deathType?: string | null;
  deathCause?: string | null;
  buyerName?: string | null;
  salePriceTotal?: number | null;
  salePricePerKg?: number | null;
  saleWeightKg?: number | null;
  gtaNumber?: string | null;
  destinationFarm?: string | null;
  notes?: string | null;
}

export interface BulkAnimalExitPayload extends CreateAnimalExitPayload {
  animalIds: string[];
}

export interface BulkAnimalExitResult {
  created: number;
  failed: number;
  errors: Array<{ animalId: string; earTag?: string; reason: string }>;
}
