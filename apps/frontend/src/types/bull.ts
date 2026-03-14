export interface BreedComposition {
  breed: string;
  percentage: number;
}

export interface GeneticProof {
  proofName: string;
  value: number;
  reliability: number | null;
}

export interface SemenBatchItem {
  id: string;
  bullId: string;
  batchNumber: string;
  centralName: string | null;
  entryType: string;
  entryTypeLabel: string;
  entryDate: string;
  expiryDate: string | null;
  initialDoses: number;
  currentDoses: number;
  costPerDose: number; // cents
  notes: string | null;
  createdAt: string;
}

export interface BullItem {
  id: string;
  farmId: string;
  name: string;
  registryNumber: string | null;
  registryAssociation: string | null;
  breedName: string;
  breedComposition: BreedComposition[] | null;
  isOwnAnimal: boolean;
  animalId: string | null;
  ownerName: string | null;
  ownerContact: string | null;
  stayStartDate: string | null;
  stayEndDate: string | null;
  status: string;
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
  geneticProofs: GeneticProof[] | null;
  photoUrl: string | null;
  notes: string | null;
  semenStock: number; // total doses across batches
  semenBatches: SemenBatchItem[];
  createdAt: string;
}

export interface BullsResponse {
  data: BullItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateBullInput {
  name: string;
  registryNumber: string | null;
  registryAssociation: string | null;
  breedName: string;
  breedComposition: BreedComposition[] | null;
  isOwnAnimal: boolean;
  animalId: string | null;
  ownerName: string | null;
  ownerContact: string | null;
  stayStartDate: string | null;
  stayEndDate: string | null;
  status: string;
  ptaMilkKg: number | null;
  ptaFatKg: number | null;
  ptaFatPct: number | null;
  ptaProteinKg: number | null;
  ptaProteinPct: number | null;
  typeScore: number | null;
  productiveLife: number | null;
  calvingEase: number | null;
  scc: number | null;
  geneticProofs: GeneticProof[] | null;
  notes: string | null;
}

export interface CreateSemenBatchInput {
  batchNumber: string;
  centralName: string | null;
  entryType: string;
  entryDate: string;
  expiryDate: string | null;
  initialDoses: number;
  costPerDose: number; // cents
  notes: string | null;
}

export const BULL_STATUSES = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'RESTING', label: 'Descansando' },
  { value: 'DISCARDED', label: 'Descartado' },
] as const;

export const SEMEN_ENTRY_TYPES = [
  { value: 'PURCHASE', label: 'Compra' },
  { value: 'DONATION', label: 'Doação' },
  { value: 'TRANSFER', label: 'Transferência' },
] as const;
