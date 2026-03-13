// ─── Error ──────────────────────────────────────────────────────────

export class GrainDiscountError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'GrainDiscountError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const DISCOUNT_TYPES = ['MOISTURE', 'IMPURITY', 'DAMAGED'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const GRADE_TYPES = ['TIPO_1', 'TIPO_2', 'TIPO_3', 'FORA_DE_TIPO'] as const;
export type GradeType = (typeof GRADE_TYPES)[number];

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

/**
 * Default ANEC discount tables by crop.
 * thresholdPct = limite de tolerância (acima → desconto)
 * discountPctPerPoint = % desconto por ponto percentual acima do threshold
 * maxPct = limite máximo aceito (acima → lote rejeitado)
 */
export const DEFAULT_DISCOUNT_TABLES: Record<
  string,
  Record<DiscountType, { thresholdPct: number; discountPctPerPoint: number; maxPct: number | null }>
> = {
  SOJA: {
    MOISTURE: { thresholdPct: 14, discountPctPerPoint: 1.5, maxPct: 30 },
    IMPURITY: { thresholdPct: 1, discountPctPerPoint: 1.0, maxPct: 5 },
    DAMAGED: { thresholdPct: 8, discountPctPerPoint: 1.0, maxPct: 40 },
  },
  MILHO: {
    MOISTURE: { thresholdPct: 14, discountPctPerPoint: 1.5, maxPct: 30 },
    IMPURITY: { thresholdPct: 1, discountPctPerPoint: 1.0, maxPct: 5 },
    DAMAGED: { thresholdPct: 6, discountPctPerPoint: 1.0, maxPct: 40 },
  },
  FEIJAO: {
    MOISTURE: { thresholdPct: 14, discountPctPerPoint: 1.5, maxPct: 30 },
    IMPURITY: { thresholdPct: 1, discountPctPerPoint: 1.0, maxPct: 4 },
    DAMAGED: { thresholdPct: 6, discountPctPerPoint: 1.0, maxPct: 30 },
  },
  TRIGO: {
    MOISTURE: { thresholdPct: 13, discountPctPerPoint: 1.5, maxPct: 25 },
    IMPURITY: { thresholdPct: 1, discountPctPerPoint: 1.0, maxPct: 3 },
    DAMAGED: { thresholdPct: 5, discountPctPerPoint: 1.0, maxPct: 30 },
  },
  SORGO: {
    MOISTURE: { thresholdPct: 13, discountPctPerPoint: 1.5, maxPct: 25 },
    IMPURITY: { thresholdPct: 1, discountPctPerPoint: 1.0, maxPct: 5 },
    DAMAGED: { thresholdPct: 5, discountPctPerPoint: 1.0, maxPct: 30 },
  },
  ARROZ: {
    MOISTURE: { thresholdPct: 13, discountPctPerPoint: 1.5, maxPct: 25 },
    IMPURITY: { thresholdPct: 1, discountPctPerPoint: 1.0, maxPct: 3 },
    DAMAGED: { thresholdPct: 4, discountPctPerPoint: 1.0, maxPct: 25 },
  },
};

/**
 * Default MAPA grain classification limits per crop.
 * Based on IN 11/2007 (soja), IN 60/2011 (milho), etc.
 */
export const DEFAULT_CLASSIFICATIONS: Record<
  string,
  Record<
    GradeType,
    {
      maxMoisturePct: number;
      maxImpurityPct: number;
      maxDamagedPct: number;
      maxBrokenPct: number;
    }
  >
> = {
  SOJA: {
    TIPO_1: { maxMoisturePct: 14, maxImpurityPct: 1, maxDamagedPct: 8, maxBrokenPct: 30 },
    TIPO_2: { maxMoisturePct: 14, maxImpurityPct: 2, maxDamagedPct: 15, maxBrokenPct: 30 },
    TIPO_3: { maxMoisturePct: 14, maxImpurityPct: 3, maxDamagedPct: 30, maxBrokenPct: 40 },
    FORA_DE_TIPO: {
      maxMoisturePct: 100,
      maxImpurityPct: 100,
      maxDamagedPct: 100,
      maxBrokenPct: 100,
    },
  },
  MILHO: {
    TIPO_1: { maxMoisturePct: 14.5, maxImpurityPct: 1.5, maxDamagedPct: 6, maxBrokenPct: 3 },
    TIPO_2: { maxMoisturePct: 14.5, maxImpurityPct: 2, maxDamagedPct: 12, maxBrokenPct: 5 },
    TIPO_3: { maxMoisturePct: 14.5, maxImpurityPct: 3, maxDamagedPct: 20, maxBrokenPct: 8 },
    FORA_DE_TIPO: {
      maxMoisturePct: 100,
      maxImpurityPct: 100,
      maxDamagedPct: 100,
      maxBrokenPct: 100,
    },
  },
};

// ─── Input Types ────────────────────────────────────────────────────

export interface UpsertDiscountTableInput {
  crop: string;
  discountType: string;
  thresholdPct: number;
  discountPctPerPoint: number;
  maxPct?: number | null;
}

export interface UpsertClassificationInput {
  crop: string;
  gradeType: string;
  maxMoisturePct: number;
  maxImpurityPct: number;
  maxDamagedPct: number;
  maxBrokenPct: number;
}

// ─── Response Types ─────────────────────────────────────────────────

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

// ─── CA4: Discount Breakdown ────────────────────────────────────────

export interface DiscountBreakdown {
  crop: string;
  grossProductionKg: number;
  moisturePct: number;
  impurityPct: number;
  damagedPct: number;
  brokenPct: number;
  moistureDiscount: {
    thresholdPct: number;
    excessPoints: number;
    discountPctPerPoint: number;
    discountPct: number;
    discountKg: number;
  };
  impurityDiscount: {
    thresholdPct: number;
    excessPoints: number;
    discountPctPerPoint: number;
    discountPct: number;
    discountKg: number;
  };
  damagedDiscount: {
    thresholdPct: number;
    excessPoints: number;
    discountPctPerPoint: number;
    discountPct: number;
    discountKg: number;
  };
  totalDiscountPct: number;
  totalDiscountKg: number;
  netProductionKg: number;
  classification: string;
  classificationLabel: string;
  warnings: string[];
}

export interface CalculateDiscountInput {
  crop: string;
  grossProductionKg: number;
  moisturePct: number;
  impurityPct: number;
  damagedPct?: number;
  brokenPct?: number;
}
