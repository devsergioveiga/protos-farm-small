// ─── Payroll Legal Tables Service ────────────────────────────────────

import { withRlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import type {
  CreateLegalTableInput,
  LegalTableQuery,
  LegalTableOutput,
} from './payroll-tables.types';
import type { LegalTableType } from '@prisma/client';

// ─── Error class ──────────────────────────────────────────────────────

export class PayrollTableError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'PayrollTableError';
  }
}

// ─── Service ──────────────────────────────────────────────────────────

export const payrollTablesService = {
  async list(orgId: string, query: LegalTableQuery): Promise<LegalTableOutput[]> {
    const where: Record<string, unknown> = {};

    if (query.tableType !== undefined) {
      where.tableType = query.tableType;
    }

    if (query.effectiveAt) {
      const effectiveDate = new Date(query.effectiveAt);
      where.effectiveFrom = { lte: effectiveDate };
    }

    // Fetch org-specific tables using RLS
    const orgTables = await withRlsContext({ organizationId: orgId }, async (tx) => {
      return tx.payrollLegalTable.findMany({
        where: { ...where, organizationId: orgId },
        orderBy: { effectiveFrom: 'desc' },
        include: {
          brackets: { orderBy: { order: 'asc' } },
          scalarValues: true,
        },
      });
    });

    // Fetch global tables (organizationId = null) — no RLS needed
    const globalTables = await prisma.payrollLegalTable.findMany({
      where: { ...where, organizationId: null },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        brackets: { orderBy: { order: 'asc' } },
        scalarValues: true,
      },
    });

    // Merge: org-specific first, then global
    const allTables = [...orgTables, ...globalTables];

    return allTables as LegalTableOutput[];
  },

  async getEffective(
    orgId: string,
    tableType: LegalTableType,
    competenceDate: Date,
  ): Promise<LegalTableOutput | null> {
    // First: look for org-specific table
    const orgTable = await withRlsContext({ organizationId: orgId }, async (tx) => {
      return tx.payrollLegalTable.findFirst({
        where: {
          organizationId: orgId,
          tableType,
          effectiveFrom: { lte: competenceDate },
        },
        orderBy: { effectiveFrom: 'desc' },
        include: {
          brackets: { orderBy: { order: 'asc' } },
          scalarValues: true,
        },
      });
    });

    if (orgTable) {
      return orgTable as LegalTableOutput;
    }

    // Fallback: look for global table (organizationId = null)
    const globalTable = await prisma.payrollLegalTable.findFirst({
      where: {
        organizationId: null,
        tableType,
        effectiveFrom: { lte: competenceDate },
      },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        brackets: { orderBy: { order: 'asc' } },
        scalarValues: true,
      },
    });

    return (globalTable as LegalTableOutput | null) ?? null;
  },

  async create(
    orgId: string,
    data: CreateLegalTableInput,
    userId: string,
  ): Promise<LegalTableOutput> {
    // Validate: effectiveFrom must be first day of month
    const effectiveDate = new Date(data.effectiveFrom);
    if (effectiveDate.getUTCDate() !== 1) {
      throw new PayrollTableError(
        'A data de vigência (effectiveFrom) deve ser o primeiro dia do mês',
        400,
      );
    }

    return withRlsContext({ organizationId: orgId }, async (tx) => {
      // Check for duplicate (same org + tableType + effectiveFrom)
      const existing = await tx.payrollLegalTable.findFirst({
        where: {
          organizationId: orgId,
          tableType: data.tableType,
          effectiveFrom: effectiveDate,
        },
        select: { id: true },
      });

      if (existing) {
        throw new PayrollTableError(
          `Já existe uma tabela do tipo ${data.tableType} com vigência em ${data.effectiveFrom} para esta organização`,
          409,
        );
      }

      const table = await tx.payrollLegalTable.create({
        data: {
          organizationId: orgId,
          tableType: data.tableType,
          stateCode: data.stateCode ?? null,
          effectiveFrom: effectiveDate,
          notes: data.notes ?? null,
          createdBy: userId,
          brackets: data.brackets
            ? {
                create: data.brackets.map((b) => ({
                  fromValue: b.fromValue,
                  upTo: b.upTo ?? null,
                  rate: b.rate,
                  deduction: b.deduction ?? null,
                  order: b.order,
                })),
              }
            : undefined,
          scalarValues: data.scalarValues
            ? {
                create: data.scalarValues.map((s) => ({
                  key: s.key,
                  value: s.value,
                })),
              }
            : undefined,
        },
        include: {
          brackets: { orderBy: { order: 'asc' } },
          scalarValues: true,
        },
      });

      return table as LegalTableOutput;
    });
  },

  async getById(orgId: string, id: string): Promise<LegalTableOutput> {
    // Try org-specific first
    const orgTable = await withRlsContext({ organizationId: orgId }, async (tx) => {
      return tx.payrollLegalTable.findFirst({
        where: { id, organizationId: orgId },
        include: {
          brackets: { orderBy: { order: 'asc' } },
          scalarValues: true,
        },
      });
    });

    if (orgTable) {
      return orgTable as LegalTableOutput;
    }

    // Try global table (null org)
    const globalTable = await prisma.payrollLegalTable.findFirst({
      where: { id, organizationId: null },
      include: {
        brackets: { orderBy: { order: 'asc' } },
        scalarValues: true,
      },
    });

    if (!globalTable) {
      throw new PayrollTableError('Tabela não encontrada', 404);
    }

    return globalTable as LegalTableOutput;
  },
};
