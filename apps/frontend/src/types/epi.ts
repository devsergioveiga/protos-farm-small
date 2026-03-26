export interface EpiProduct {
  id: string;
  productId: string;
  productName: string;
  caNumber: string;
  caExpiry: string | null;
  epiType: string;
  currentStock: number;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EpiDelivery {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string | null;
  epiProductId: string;
  epiProductName: string;
  caNumber: string;
  date: string;
  quantity: number;
  reason: 'NOVO' | 'TROCA' | 'DANIFICADO' | 'EXTRAVIO';
  signatureUrl: string | null;
  observations: string | null;
  stockOutputId: string | null;
  createdAt: string;
}

export interface PositionEpiRequirement {
  id: string;
  positionId: string;
  positionName: string;
  epiProductId: string;
  epiProductName: string;
  quantity: number;
}

export interface Position {
  id: string;
  name: string;
}

export interface CreateEpiProductInput {
  productId: string;
  caNumber: string;
  caExpiry?: string;
  epiType: string;
}

export interface UpdateEpiProductInput {
  caNumber?: string;
  caExpiry?: string;
  epiType?: string;
}

export interface CreateEpiDeliveryInput {
  employeeId: string;
  epiProductId: string;
  date: string;
  quantity: number;
  reason: string;
  signatureUrl?: string;
  observations?: string;
}

export interface CreatePositionEpiRequirementInput {
  positionId: string;
  epiProductId: string;
  quantity?: number;
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

export const EPI_TYPE_LABELS: Record<string, string> = {
  CAPACETE: 'Capacete',
  LUVA: 'Luva',
  BOTA: 'Bota',
  OCULOS: 'Óculos',
  PROTETOR_AURICULAR: 'Protetor Auricular',
  MASCARA: 'Máscara',
  AVENTAL: 'Avental',
  CINTO: 'Cinto',
  PERNEIRA: 'Perneira',
  OUTROS: 'Outros',
};

export const DELIVERY_REASON_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  TROCA: 'Troca',
  DANIFICADO: 'Danificado',
  EXTRAVIO: 'Extravio',
};
