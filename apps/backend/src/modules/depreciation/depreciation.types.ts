import Decimal from 'decimal.js';

export class DepreciationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'DepreciationError';
  }
}

export interface EngineInput {
  acquisitionValue: Decimal;
  residualValue: Decimal;
  openingBookValue: Decimal;
  config: {
    method: 'STRAIGHT_LINE' | 'HOURS_OF_USE' | 'UNITS_OF_PRODUCTION' | 'ACCELERATED';
    fiscalAnnualRate?: Decimal;
    managerialAnnualRate?: Decimal;
    usefulLifeMonths?: number;
    accelerationFactor?: Decimal;
    totalHours?: Decimal;
    totalUnits?: Decimal;
    track: 'FISCAL' | 'MANAGERIAL';
  };
  period: { year: number; month: number };
  acquisitionDate: Date;
  disposalDate?: Date | null;
  periodicHours?: Decimal;
  periodicUnits?: Decimal;
}

export interface EngineOutput {
  depreciationAmount: Decimal;
  closingBookValue: Decimal;
  proRataDays: number | null;
  daysInMonth: number;
  skipped: boolean;
  skipReason?: string;
}

export interface CreateDepreciationConfigInput {
  assetId: string;
  method?: 'STRAIGHT_LINE' | 'HOURS_OF_USE' | 'UNITS_OF_PRODUCTION' | 'ACCELERATED';
  fiscalAnnualRate?: number;
  managerialAnnualRate?: number;
  usefulLifeMonths?: number;
  residualValue?: number;
  totalHours?: number;
  totalUnits?: number;
  accelerationFactor?: number;
  activeTrack?: 'FISCAL' | 'MANAGERIAL';
}

export type UpdateDepreciationConfigInput = Partial<Omit<CreateDepreciationConfigInput, 'assetId'>>;

export interface RunDepreciationInput {
  organizationId: string;
  periodYear: number;
  periodMonth: number;
  track?: 'FISCAL' | 'MANAGERIAL';
  triggeredBy: string;
  force?: boolean;
}

export interface DepreciationReportQuery {
  organizationId: string;
  periodYear: number;
  periodMonth: number;
  track?: 'FISCAL' | 'MANAGERIAL';
  assetId?: string;
  page?: number;
  limit?: number;
}

// RFB default rates (IN RFB 1.700/2017)
export const DEFAULT_RFB_RATES: Record<string, { annualRate: number; usefulLifeMonths: number }> = {
  MAQUINA: { annualRate: 0.1, usefulLifeMonths: 120 },
  VEICULO: { annualRate: 0.2, usefulLifeMonths: 60 },
  IMPLEMENTO: { annualRate: 0.1, usefulLifeMonths: 120 },
  BENFEITORIA: { annualRate: 0.04, usefulLifeMonths: 300 },
  TERRA: { annualRate: 0, usefulLifeMonths: 0 },
};

export interface RlsContext {
  organizationId: string;
  userId: string;
}
