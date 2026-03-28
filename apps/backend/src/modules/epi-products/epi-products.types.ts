export class EpiProductError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'EpiProductError';
  }
}

export const EPI_TYPES = [
  'CAPACETE',
  'LUVA',
  'BOTA',
  'OCULOS',
  'PROTETOR_AURICULAR',
  'MASCARA',
  'AVENTAL',
  'CINTO',
  'PERNEIRA',
  'OUTROS',
] as const;
export type EpiType = (typeof EPI_TYPES)[number];

export interface CreateEpiProductInput {
  productId: string;
  caNumber: string;
  caExpiry?: string; // ISO date
  epiType: EpiType;
}

export interface UpdateEpiProductInput {
  caNumber?: string;
  caExpiry?: string;
  epiType?: EpiType;
}

export interface EpiProductOutput {
  id: string;
  productId: string;
  productName: string;
  caNumber: string;
  caExpiry: string | null;
  epiType: EpiType;
  currentStock: number;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePositionEpiRequirementInput {
  positionId: string;
  epiProductId: string;
  quantity?: number;
}

export interface PositionEpiRequirementOutput {
  id: string;
  positionId: string;
  positionName: string;
  epiProductId: string;
  epiProductName: string;
  quantity: number;
}
