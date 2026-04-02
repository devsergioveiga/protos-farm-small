// ─── Error ──────────────────────────────────────────────────────────

export class BullError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'BullError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const BULL_STATUSES = ['ACTIVE', 'RESTING', 'DISCARDED'] as const;
export type BullStatusValue = (typeof BULL_STATUSES)[number];

export const BULL_STATUS_LABELS: Record<BullStatusValue, string> = {
  ACTIVE: 'Ativo',
  RESTING: 'Em descanso',
  DISCARDED: 'Descartado',
};

export function isValidBullStatus(value: string): value is BullStatusValue {
  return BULL_STATUSES.includes(value as BullStatusValue);
}

export const SEMEN_ENTRY_TYPES = ['PURCHASE', 'DONATION', 'TRANSFER'] as const;
export type SemenEntryTypeValue = (typeof SEMEN_ENTRY_TYPES)[number];

export const SEMEN_ENTRY_TYPE_LABELS: Record<SemenEntryTypeValue, string> = {
  PURCHASE: 'Compra',
  DONATION: 'Doação',
  TRANSFER: 'Transferência',
};

export function isValidSemenEntryType(value: string): value is SemenEntryTypeValue {
  return SEMEN_ENTRY_TYPES.includes(value as SemenEntryTypeValue);
}

export const SEMEN_TYPES = ['CONVENTIONAL', 'SEXED_FEMALE', 'SEXED_MALE'] as const;
export type SemenTypeValue = (typeof SEMEN_TYPES)[number];

export const SEMEN_TYPE_LABELS: Record<SemenTypeValue, string> = {
  CONVENTIONAL: 'Convencional',
  SEXED_FEMALE: 'Sexado fêmea',
  SEXED_MALE: 'Sexado macho',
};

export function isValidSemenType(value: string): value is SemenTypeValue {
  return SEMEN_TYPES.includes(value as SemenTypeValue);
}

// ─── Breed Composition ─────────────────────────────────────────────

export interface BreedCompositionEntry {
  breed: string;
  percentage: number;
}

// ─── Genetic Proof ─────────────────────────────────────────────────

export interface GeneticProofEntry {
  proofName: string;
  value: number;
  reliability?: number;
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateBullInput {
  name: string;
  registryNumber?: string | null;
  registryAssociation?: string | null;
  breedName: string;
  breedComposition?: BreedCompositionEntry[] | null;
  isOwnAnimal?: boolean;
  animalId?: string | null;
  ownerName?: string | null;
  ownerContact?: string | null;
  stayStartDate?: string | null; // ISO date
  stayEndDate?: string | null; // ISO date
  status?: BullStatusValue;
  ptaMilkKg?: number | null;
  ptaFatKg?: number | null;
  ptaFatPct?: number | null;
  ptaProteinKg?: number | null;
  ptaProteinPct?: number | null;
  typeScore?: number | null;
  productiveLife?: number | null;
  calvingEase?: number | null;
  scc?: number | null;
  geneticProofs?: GeneticProofEntry[] | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export interface UpdateBullInput {
  name?: string;
  registryNumber?: string | null;
  registryAssociation?: string | null;
  breedName?: string;
  breedComposition?: BreedCompositionEntry[] | null;
  isOwnAnimal?: boolean;
  animalId?: string | null;
  ownerName?: string | null;
  ownerContact?: string | null;
  stayStartDate?: string | null;
  stayEndDate?: string | null;
  status?: BullStatusValue;
  ptaMilkKg?: number | null;
  ptaFatKg?: number | null;
  ptaFatPct?: number | null;
  ptaProteinKg?: number | null;
  ptaProteinPct?: number | null;
  typeScore?: number | null;
  productiveLife?: number | null;
  calvingEase?: number | null;
  scc?: number | null;
  geneticProofs?: GeneticProofEntry[] | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export interface ListBullsQuery {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CreateSemenBatchInput {
  batchNumber: string;
  centralName?: string | null;
  entryType?: SemenEntryTypeValue;
  semenType?: SemenTypeValue;
  entryDate: string; // ISO date
  expiryDate?: string | null;
  initialDoses: number;
  costPerDose?: number; // cents
  notes?: string | null;
}

export interface UpdateSemenBatchInput {
  batchNumber?: string;
  centralName?: string | null;
  entryType?: SemenEntryTypeValue;
  semenType?: SemenTypeValue;
  entryDate?: string;
  expiryDate?: string | null;
  costPerDose?: number;
  notes?: string | null;
}

export interface UseSemenInput {
  dosesUsed: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface BullItem {
  id: string;
  organizationId: string;
  farmId: string;
  name: string;
  registryNumber: string | null;
  registryAssociation: string | null;
  breedName: string;
  breedComposition: BreedCompositionEntry[] | null;
  isOwnAnimal: boolean;
  animalId: string | null;
  animalEarTag: string | null;
  ownerName: string | null;
  ownerContact: string | null;
  stayStartDate: string | null;
  stayEndDate: string | null;
  status: BullStatusValue;
  statusLabel: string;
  ptaMilkKg: number | null;
  ptaFatKg: number | null;
  ptaFatPct: number | null;
  ptaProteinKg: number | null;
  ptaProteinPct: number | null;
  typeScore: number | null;
  productiveLife: number | null;
  calvingEase: number | null;
  scc: number | null;
  geneticProofs: GeneticProofEntry[] | null;
  photoUrl: string | null;
  notes: string | null;
  semenStock: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SemenBatchItem {
  id: string;
  organizationId: string;
  bullId: string;
  batchNumber: string;
  centralName: string | null;
  entryType: SemenEntryTypeValue;
  entryTypeLabel: string;
  semenType: SemenTypeValue;
  semenTypeLabel: string;
  entryDate: string;
  expiryDate: string | null;
  initialDoses: number;
  currentDoses: number;
  costPerDose: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BullWithBatches extends BullItem {
  semenBatches: SemenBatchItem[];
}

export interface BullCatalogItem {
  id: string;
  name: string;
  breedName: string;
  registryNumber: string | null;
  registryAssociation: string | null;
  status: BullStatusValue;
  statusLabel: string;
  ptaMilkKg: number | null;
  ptaFatKg: number | null;
  ptaFatPct: number | null;
  ptaProteinKg: number | null;
  ptaProteinPct: number | null;
  typeScore: number | null;
  productiveLife: number | null;
  calvingEase: number | null;
  scc: number | null;
  semenStock: number;
  farmId: string;
}

export interface BullUsageHistoryItem {
  bullId: string;
  bullName: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  serviceDate: string;
  serviceType: string; // 'IA' | 'MONTA'
  result: string | null; // 'PRENHA' | 'VAZIA' | null (pending)
  resultDate: string | null;
}

export interface ImportBullsResult {
  imported: number;
  skipped: number;
  errors: string[];
}
