import type { TaxGuideType, TaxGuideStatus } from '@prisma/client';

export class TaxGuideError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'TaxGuideError';
  }
}

export interface TaxGuideOutput {
  id: string;
  organizationId: string;
  guideType: TaxGuideType;
  referenceMonth: string; // ISO date
  dueDate: string;
  totalAmount: string; // Decimal as string
  status: TaxGuideStatus;
  fileKey: string | null;
  payrollRunId: string | null;
  generatedBy: string | null;
  generatedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  daysUntilDue?: number; // computed field for alerts (per D-03)
  alertLevel?: 'none' | 'warning' | 'danger'; // yellow 10 days, red 5 days (per D-03)
}

export interface GenerateTaxGuidesInput {
  referenceMonth: string; // YYYY-MM-DD (first day of month)
  guideTypes?: TaxGuideType[]; // if omitted, generate all 4
  payrollRunId?: string; // optional: link to specific run
}

export interface ListTaxGuidesQuery {
  referenceMonth?: string;
  guideType?: TaxGuideType;
  status?: TaxGuideStatus;
  page?: number;
  limit?: number;
}

export const TAX_GUIDE_DUE_DAYS: Record<TaxGuideType, number> = {
  FGTS: 7,      // dia 7 do mês seguinte
  INSS: 20,     // dia 20 do mês seguinte
  IRRF: 20,     // dia 20 do mês seguinte
  FUNRURAL: 20, // dia 20 do mês seguinte
};

export const TAX_GUIDE_RECEITA_CODES: Record<TaxGuideType, string> = {
  FGTS: '8050',     // SEFIP code (not a Receita code)
  INSS: '1120',     // DARF Receita code for INSS empregador
  IRRF: '0561',     // DARF Receita code for IRRF trabalho
  FUNRURAL: '2607', // GPS/DARF code FUNRURAL
};
