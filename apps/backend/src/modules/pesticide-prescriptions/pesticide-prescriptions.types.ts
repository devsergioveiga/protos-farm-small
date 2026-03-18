// ─── Error ──────────────────────────────────────────────────────────

export class PrescriptionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PrescriptionError';
  }
}

// ─── Enums / Constants ──────────────────────────────────────────────

export const PRESCRIPTION_STATUSES = ['ACTIVE', 'CANCELLED', 'EXPIRED'] as const;
export type PrescriptionStatusValue = (typeof PRESCRIPTION_STATUSES)[number];

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatusValue, string> = {
  ACTIVE: 'Ativa',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
};

export const DOSE_UNITS = ['L_HA', 'KG_HA', 'ML_HA', 'G_HA'] as const;
export type DoseUnitValue = (typeof DOSE_UNITS)[number];

export const DOSE_UNIT_LABELS: Record<DoseUnitValue, string> = {
  L_HA: 'L/ha',
  KG_HA: 'kg/ha',
  ML_HA: 'mL/ha',
  G_HA: 'g/ha',
};

export const TARGET_TYPES = ['PRAGA', 'DOENCA', 'PLANTA_DANINHA'] as const;
export type TargetTypeValue = (typeof TARGET_TYPES)[number];

export const TARGET_TYPE_LABELS: Record<TargetTypeValue, string> = {
  PRAGA: 'Praga',
  DOENCA: 'Doença',
  PLANTA_DANINHA: 'Planta daninha',
};

// ─── Inputs ─────────────────────────────────────────────────────────

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

export interface UpdatePrescriptionInput {
  cultureName?: string;
  targetPest?: string;
  targetType?: string;
  sprayVolume?: number;
  numberOfApplications?: number;
  applicationInterval?: number | null;
  agronomistName?: string;
  agronomistCrea?: string;
  agronomistSignatureUrl?: string | null;
  pesticideApplicationId?: string | null;
  stockOutputId?: string | null;
  technicalJustification?: string | null;
  notes?: string | null;
  status?: string;
  products?: PrescriptionProductInput[];
}

// ─── Outputs ────────────────────────────────────────────────────────

export interface PrescriptionProductOutput {
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

export interface PrescriptionOutput {
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
  products: PrescriptionProductOutput[];
  createdAt: string;
  updatedAt: string;
}

export interface PrescriptionListQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  fieldPlotId?: string;
}
