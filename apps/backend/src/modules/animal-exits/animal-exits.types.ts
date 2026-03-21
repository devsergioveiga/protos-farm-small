// ─── Error ──────────────────────────────────────────────────────────

export class AnimalExitError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnimalExitError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const EXIT_TYPES = [
  'MORTE',
  'VENDA',
  'DOACAO',
  'ABATE',
  'TRANSFERENCIA',
  'PERDA',
] as const;
export type ExitTypeValue = (typeof EXIT_TYPES)[number];

export const EXIT_TYPE_LABELS: Record<ExitTypeValue, string> = {
  MORTE: 'Morte',
  VENDA: 'Venda',
  DOACAO: 'Doação',
  ABATE: 'Abate',
  TRANSFERENCIA: 'Transferência',
  PERDA: 'Perda',
};

export const DEATH_TYPES = [
  'NATURAL',
  'ACIDENTE',
  'DOENCA',
  'PREDADOR',
  'DESCONHECIDA',
] as const;
export type DeathTypeValue = (typeof DEATH_TYPES)[number];

export const DEATH_TYPE_LABELS: Record<DeathTypeValue, string> = {
  NATURAL: 'Natural',
  ACIDENTE: 'Acidente',
  DOENCA: 'Doença',
  PREDADOR: 'Predador',
  DESCONHECIDA: 'Desconhecida',
};

export function isValidExitType(value: string): value is ExitTypeValue {
  return EXIT_TYPES.includes(value as ExitTypeValue);
}

export function isValidDeathType(value: string): value is DeathTypeValue {
  return DEATH_TYPES.includes(value as DeathTypeValue);
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateAnimalExitInput {
  exitType: ExitTypeValue;
  exitDate: string; // ISO date
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

export interface BulkAnimalExitInput {
  animalIds: string[];
  exitType: ExitTypeValue;
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

export interface ListAnimalExitsQuery {
  exitType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface AnimalExitItem {
  id: string;
  animalId: string;
  farmId: string;
  animalEarTag: string;
  animalName: string | null;
  exitType: ExitTypeValue;
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

export interface BulkAnimalExitResult {
  created: number;
  failed: number;
  errors: Array<{ animalId: string; earTag?: string; reason: string }>;
}
