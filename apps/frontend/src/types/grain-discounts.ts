export interface DiscountTableItem {
  id: string;
  organizationId: string;
  crop: string;
  discountType: string;
  discountTypeLabel: string;
  thresholdPct: number;
  discountPctPerPoint: number;
  maxPct: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassificationItem {
  id: string;
  organizationId: string;
  crop: string;
  gradeType: string;
  gradeTypeLabel: string;
  maxMoisturePct: number;
  maxImpurityPct: number;
  maxDamagedPct: number;
  maxBrokenPct: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountBreakdown {
  crop: string;
  grossProductionKg: number;
  moisturePct: number;
  impurityPct: number;
  damagedPct: number;
  brokenPct: number;
  moistureDiscount: DiscountDetail;
  impurityDiscount: DiscountDetail;
  damagedDiscount: DiscountDetail;
  totalDiscountPct: number;
  totalDiscountKg: number;
  netProductionKg: number;
  classification: string;
  classificationLabel: string;
  warnings: string[];
}

export interface DiscountDetail {
  thresholdPct: number;
  excessPoints: number;
  discountPctPerPoint: number;
  discountPct: number;
  discountKg: number;
}

export const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  MOISTURE: 'Umidade',
  IMPURITY: 'Impureza',
  DAMAGED: 'Avariados',
};

export const GRADE_TYPE_LABELS: Record<string, string> = {
  TIPO_1: 'Tipo 1',
  TIPO_2: 'Tipo 2',
  TIPO_3: 'Tipo 3',
  FORA_DE_TIPO: 'Fora de Tipo',
};

export const CROP_LABELS: Record<string, string> = {
  SOJA: 'Soja',
  MILHO: 'Milho',
  FEIJAO: 'Feijão',
  TRIGO: 'Trigo',
  SORGO: 'Sorgo',
  ARROZ: 'Arroz',
};

export const DISCOUNT_TYPES = ['MOISTURE', 'IMPURITY', 'DAMAGED'] as const;
export const GRADE_TYPES = ['TIPO_1', 'TIPO_2', 'TIPO_3', 'FORA_DE_TIPO'] as const;
export const CROPS = ['SOJA', 'MILHO', 'FEIJAO', 'TRIGO', 'SORGO', 'ARROZ'] as const;
