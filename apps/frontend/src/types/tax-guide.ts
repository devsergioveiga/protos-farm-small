export type TaxGuideType = 'FGTS' | 'INSS' | 'IRRF' | 'FUNRURAL';
export type TaxGuideStatus = 'PENDING' | 'GENERATED' | 'PAID' | 'OVERDUE';
export type AlertLevel = 'none' | 'warning' | 'danger';

export interface TaxGuide {
  id: string;
  organizationId: string;
  guideType: TaxGuideType;
  referenceMonth: string;
  dueDate: string;
  totalAmount: string;
  status: TaxGuideStatus;
  fileKey: string | null;
  payrollRunId: string | null;
  generatedBy: string | null;
  generatedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  daysUntilDue?: number;
  alertLevel?: AlertLevel;
}

export interface GenerateTaxGuidesInput {
  referenceMonth: string;
  guideTypes?: TaxGuideType[];
  payrollRunId?: string;
}

export const TAX_GUIDE_TYPE_LABELS: Record<TaxGuideType, string> = {
  FGTS: 'FGTS',
  INSS: 'INSS',
  IRRF: 'IRRF',
  FUNRURAL: 'FUNRURAL',
};

export const TAX_GUIDE_STATUS_LABELS: Record<TaxGuideStatus, string> = {
  PENDING: 'Pendente',
  GENERATED: 'Gerada',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
};
