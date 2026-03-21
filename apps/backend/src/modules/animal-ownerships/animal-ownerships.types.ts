// ─── Error ──────────────────────────────────────────────────────────

export class AnimalOwnershipError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnimalOwnershipError';
  }
}

// ─── Constants ──────────────────────────────────────────────────────

export const OWNERSHIP_TYPES = ['PROPRIETARIO', 'PARCEIRO', 'COMODATARIO', 'DEPOSITARIO'] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const OWNERSHIP_TYPE_LABELS_PT: Record<OwnershipType, string> = {
  PROPRIETARIO: 'Proprietário',
  PARCEIRO: 'Parceiro',
  COMODATARIO: 'Comodatário',
  DEPOSITARIO: 'Depositário',
};

// ─── Input types ────────────────────────────────────────────────────

export interface CreateOwnershipInput {
  animalId: string;
  producerId: string;
  ownershipType?: string;
  participationPct?: number;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface UpdateOwnershipInput {
  ownershipType?: string;
  participationPct?: number | null;
  startDate?: string;
  endDate?: string | null;
  notes?: string | null;
}

export interface BulkAssignOwnerInput {
  animalIds: string[];
  producerId: string;
  ownershipType?: string;
  participationPct?: number;
  startDate: string;
  notes?: string;
}

export interface ListOwnershipsQuery {
  page?: number;
  limit?: number;
  ownershipType?: string;
  producerId?: string;
  activeOnly?: boolean;
}

// ─── Response types ─────────────────────────────────────────────────

export interface OwnershipItem {
  id: string;
  animalId: string;
  producerId: string;
  ownershipType: string;
  participationPct: number | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  producer: {
    id: string;
    name: string;
    document: string | null;
    type: string;
  };
  animal?: {
    id: string;
    earTag: string;
    name: string | null;
  };
}
