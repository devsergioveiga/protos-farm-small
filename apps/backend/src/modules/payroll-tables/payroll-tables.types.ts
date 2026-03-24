// ─── Payroll Legal Tables Types ───────────────────────────────────────

import type { LegalTableType } from '@prisma/client';

// ─── Input Types ──────────────────────────────────────────────────────

export interface CreateBracketInput {
  fromValue: number;
  upTo?: number | null;
  rate: number;
  deduction?: number;
  order: number;
}

export interface CreateScalarInput {
  key: string;
  value: number;
}

export interface CreateLegalTableInput {
  tableType: LegalTableType;
  stateCode?: string;
  effectiveFrom: string; // ISO date string, should be first day of month
  notes?: string;
  brackets?: CreateBracketInput[];
  scalarValues?: CreateScalarInput[];
}

// ─── Query Types ──────────────────────────────────────────────────────

export interface LegalTableQuery {
  tableType?: LegalTableType;
  effectiveAt?: string; // ISO date — returns the table effective at that date
}

// ─── Output Types ─────────────────────────────────────────────────────

export interface BracketOutput {
  id: string;
  fromValue: string;
  upTo: string | null;
  rate: string;
  deduction: string | null;
  order: number;
}

export interface ScalarOutput {
  id: string;
  key: string;
  value: string;
}

export interface LegalTableOutput {
  id: string;
  organizationId: string | null;
  tableType: LegalTableType;
  stateCode: string | null;
  effectiveFrom: Date;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  brackets: BracketOutput[];
  scalarValues: ScalarOutput[];
}
