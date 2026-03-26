export type RubricaType = 'PROVENTO' | 'DESCONTO' | 'INFORMATIVO';
export type CalculationType = 'FIXED_VALUE' | 'PERCENTAGE' | 'FORMULA' | 'SYSTEM';
export type SystemFormulaType =
  | 'SYSTEM_INSS'
  | 'SYSTEM_IRRF'
  | 'SYSTEM_FGTS'
  | 'SYSTEM_SALARY_FAMILY'
  | 'SYSTEM_FUNRURAL';
export type LegalTableType = 'INSS' | 'IRRF' | 'SALARY_FAMILY' | 'MINIMUM_WAGE' | 'FUNRURAL';

export interface PayrollRubrica {
  id: string;
  code: string;
  name: string;
  rubricaType: RubricaType;
  calculationType: CalculationType;
  formulaType: SystemFormulaType | null;
  baseFormula: string | null;
  rate: string | null;
  fixedValue: string | null;
  incideINSS: boolean;
  incideFGTS: boolean;
  incideIRRF: boolean;
  isSystem: boolean;
  isActive: boolean;
  eSocialCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRubricaInput {
  code: string;
  name: string;
  rubricaType: RubricaType;
  calculationType: CalculationType;
  formulaType?: SystemFormulaType;
  baseFormula?: string;
  rate?: number;
  fixedValue?: number;
  incideINSS?: boolean;
  incideFGTS?: boolean;
  incideIRRF?: boolean;
  eSocialCode?: string;
}

export interface UpdateRubricaInput {
  name?: string;
  rubricaType?: RubricaType;
  calculationType?: CalculationType;
  formulaType?: SystemFormulaType;
  baseFormula?: string;
  rate?: number;
  fixedValue?: number;
  incideINSS?: boolean;
  incideFGTS?: boolean;
  incideIRRF?: boolean;
  eSocialCode?: string;
}

export interface PayrollRubricasResponse {
  data: PayrollRubrica[];
  total: number;
  page: number;
  limit: number;
}

export interface PayrollLegalTable {
  id: string;
  organizationId: string | null;
  tableType: LegalTableType;
  stateCode: string | null;
  effectiveFrom: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  brackets: PayrollTableBracket[];
  scalarValues: PayrollTableScalar[];
}

export interface PayrollTableBracket {
  id: string;
  fromValue: string;
  upTo: string | null;
  rate: string;
  deduction: string | null;
  order: number;
}

export interface PayrollTableScalar {
  id: string;
  key: string;
  value: string;
}

export interface CreateLegalTableInput {
  tableType: LegalTableType;
  stateCode?: string;
  effectiveFrom: string;
  notes?: string;
  brackets?: {
    fromValue: number;
    upTo?: number | null;
    rate: number;
    deduction?: number;
    order: number;
  }[];
  scalarValues?: { key: string; value: number }[];
}

export const RUBRICA_TYPE_LABELS: Record<RubricaType, string> = {
  PROVENTO: 'Provento',
  DESCONTO: 'Desconto',
  INFORMATIVO: 'Informativo',
};

export const CALCULATION_TYPE_LABELS: Record<CalculationType, string> = {
  FIXED_VALUE: 'Valor fixo',
  PERCENTAGE: 'Percentual',
  FORMULA: 'Fórmula',
  SYSTEM: 'Sistema',
};

export const LEGAL_TABLE_TYPE_LABELS: Record<LegalTableType, string> = {
  INSS: 'INSS',
  IRRF: 'IRRF',
  SALARY_FAMILY: 'Salário-família',
  MINIMUM_WAGE: 'Salário mínimo',
  FUNRURAL: 'FUNRURAL',
};
