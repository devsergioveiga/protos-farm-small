// ─── Payroll Rubricas Types ───────────────────────────────────────────

import type { RubricaType, CalculationType, SystemFormulaType } from '@prisma/client';

// ─── Input Types ─────────────────────────────────────────────────────

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

export interface UpdateRubricaInput extends Partial<Omit<CreateRubricaInput, 'code'>> {
  isActive?: boolean;
}

// ─── Query Types ──────────────────────────────────────────────────────

export interface RubricaListQuery {
  rubricaType?: RubricaType;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Output Types ─────────────────────────────────────────────────────

export interface RubricaOutput {
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
  createdAt: Date;
  updatedAt: Date;
}
