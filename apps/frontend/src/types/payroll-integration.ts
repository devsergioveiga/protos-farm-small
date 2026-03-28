export interface CpPreviewItem {
  type: string;
  employeeName?: string;
  amount: number;
  dueDate: string;
  costCenterItems: Array<{ costCenterName: string; percentage: number }>;
}

export interface TaxGuidePreviewItem {
  type: string;
  amount: number;
  dueDate: string;
  referenceMonth: string;
}

export interface CpPreviewResponse {
  items: CpPreviewItem[];
  taxGuideItems: TaxGuidePreviewItem[];
  totalAmount: number;
  totalTaxGuides: number;
  runTotalNet: number;
  reconciled: boolean;
}

export const CP_TYPE_LABELS: Record<string, string> = {
  PAYROLL_EMPLOYEE_NET: 'Salário líquido',
  PAYROLL_EMPLOYER_INSS: 'INSS patronal',
  PAYROLL_EMPLOYER_FGTS: 'FGTS',
  PAYROLL_EMPLOYEE_IRRF: 'IRRF',
  PAYROLL_EMPLOYEE_VT: 'Vale-transporte',
  PAYROLL_EMPLOYEE_PENSION: 'Pensão alimentícia',
  PAYROLL_EMPLOYEE_SINDICAL: 'Contribuição sindical',
};

export const CP_SECTION_KEYS: Record<string, string[]> = {
  'Salários Líquidos': ['PAYROLL_EMPLOYEE_NET'],
  'Encargos Patronais': ['PAYROLL_EMPLOYER_INSS', 'PAYROLL_EMPLOYER_FGTS'],
  'Impostos a Recolher': ['PAYROLL_EMPLOYEE_IRRF'],
  Outros: ['PAYROLL_EMPLOYEE_VT', 'PAYROLL_EMPLOYEE_PENSION', 'PAYROLL_EMPLOYEE_SINDICAL'],
};
