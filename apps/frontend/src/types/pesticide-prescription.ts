export interface PrescriptionProductItem {
  id: string;
  productId: string | null;
  productName: string;
  activeIngredient: string;
  dose: number;
  doseUnit: string;
  withdrawalPeriodDays: number | null;
  safetyIntervalDays: number | null;
  toxicityClass: string | null;
  mapaRegistration: string | null;
  environmentalClass: string | null;
}

export interface PrescriptionItem {
  id: string;
  organizationId: string;
  farmId: string;
  fieldPlotId: string;
  sequentialNumber: number;
  issuedAt: string;
  farmName: string;
  fieldPlotName: string;
  cultureName: string;
  areaHa: number;
  targetPest: string;
  targetType: string;
  sprayVolume: number;
  numberOfApplications: number;
  applicationInterval: number | null;
  agronomistName: string;
  agronomistCrea: string;
  agronomistSignatureUrl: string | null;
  pesticideApplicationId: string | null;
  stockOutputId: string | null;
  technicalJustification: string | null;
  notes: string | null;
  status: string;
  createdBy: string;
  creatorName: string;
  products: PrescriptionProductItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PrescriptionsResponse {
  data: PrescriptionItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PrescriptionProductInput {
  productId?: string | null;
  productName: string;
  activeIngredient: string;
  dose: number;
  doseUnit?: string;
  withdrawalPeriodDays?: number | null;
  safetyIntervalDays?: number | null;
  toxicityClass?: string | null;
  mapaRegistration?: string | null;
  environmentalClass?: string | null;
}

export interface CreatePrescriptionInput {
  fieldPlotId: string;
  issuedAt?: string;
  cultureName: string;
  targetPest: string;
  targetType: string;
  sprayVolume: number;
  numberOfApplications?: number;
  applicationInterval?: number | null;
  agronomistName: string;
  agronomistCrea: string;
  agronomistSignatureUrl?: string | null;
  pesticideApplicationId?: string | null;
  stockOutputId?: string | null;
  technicalJustification?: string | null;
  notes?: string | null;
  products: PrescriptionProductInput[];
}

export const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativa',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  PRAGA: 'Praga',
  DOENCA: 'Doença',
  PLANTA_DANINHA: 'Planta daninha',
};

export const TARGET_TYPES = ['PRAGA', 'DOENCA', 'PLANTA_DANINHA'] as const;

export const DOSE_UNIT_LABELS: Record<string, string> = {
  L_HA: 'L/ha',
  KG_HA: 'kg/ha',
  ML_HA: 'mL/ha',
  G_HA: 'g/ha',
};

export const DOSE_UNITS = ['L_HA', 'KG_HA', 'ML_HA', 'G_HA'] as const;
