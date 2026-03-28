// seed-payroll-2026.ts
// Seeds the 2026 Brazilian payroll legal tables (INSS, IRRF, SALARY_FAMILY, MINIMUM_WAGE, FUNRURAL).
// All tables are global (organizationId = null) so every organization can use them immediately
// without any setup. Organization-specific overrides can be created via the payroll-tables API.
//
// This script is IDEMPOTENT: it checks for existing tables before inserting.
// Can be run multiple times without error.

import { PrismaClient } from '@prisma/client';

export async function seedPayroll2026(prisma: PrismaClient): Promise<void> {
  const CREATED_BY = 'SYSTEM_SEED';
  const EFFECTIVE_JAN = new Date('2026-01-01');
  const EFFECTIVE_APR = new Date('2026-04-01');

  // ─── 1. INSS (tabela progressiva, vigência 2026) ───────────────────
  const inssExists = await prisma.payrollLegalTable.findFirst({
    where: {
      organizationId: null,
      tableType: 'INSS',
      effectiveFrom: EFFECTIVE_JAN,
    },
  });

  if (!inssExists) {
    await prisma.payrollLegalTable.create({
      data: {
        organizationId: null,
        tableType: 'INSS',
        effectiveFrom: EFFECTIVE_JAN,
        createdBy: CREATED_BY,
        notes: 'Tabela INSS 2026 — Instrução Normativa RFB',
        brackets: {
          create: [
            { fromValue: 0.0, upTo: 1621.0, rate: 0.075, order: 1 },
            { fromValue: 1621.01, upTo: 2902.84, rate: 0.09, order: 2 },
            { fromValue: 2902.85, upTo: 4354.27, rate: 0.12, order: 3 },
            { fromValue: 4354.28, upTo: 8475.55, rate: 0.14, order: 4 },
          ],
        },
        scalarValues: {
          create: [{ key: 'CEILING', value: 8475.55 }],
        },
      },
    });
  }

  // ─── 2. IRRF (tabela progressiva, vigência 2026) ──────────────────
  const irrfExists = await prisma.payrollLegalTable.findFirst({
    where: {
      organizationId: null,
      tableType: 'IRRF',
      effectiveFrom: EFFECTIVE_JAN,
    },
  });

  if (!irrfExists) {
    await prisma.payrollLegalTable.create({
      data: {
        organizationId: null,
        tableType: 'IRRF',
        effectiveFrom: EFFECTIVE_JAN,
        createdBy: CREATED_BY,
        notes: 'Tabela IRRF 2026 — Lei 14.663/2023 + tabela progressiva anual',
        brackets: {
          create: [
            { fromValue: 0.0, upTo: 2428.8, rate: 0.0, deduction: 0.0, order: 1 },
            { fromValue: 2428.81, upTo: 2826.65, rate: 0.075, deduction: 182.16, order: 2 },
            { fromValue: 2826.66, upTo: 3751.05, rate: 0.15, deduction: 394.16, order: 3 },
            { fromValue: 3751.06, upTo: 4664.68, rate: 0.225, deduction: 675.49, order: 4 },
            { fromValue: 4664.69, upTo: null, rate: 0.275, deduction: 908.73, order: 5 },
          ],
        },
        scalarValues: {
          create: [
            { key: 'DEPENDENT_DEDUCTION', value: 189.59 },
            { key: 'EXEMPTION_LIMIT', value: 5000.0 },
            // Redutor progressivo (art. 3º Lei 14.663/2023)
            { key: 'REDUTOR_UPPER_LIMIT', value: 7350.0 },
            { key: 'REDUTOR_A', value: 978.62 },
            { key: 'REDUTOR_B_RATE', value: 0.133145 },
          ],
        },
      },
    });
  }

  // ─── 3. SALARY_FAMILY (salário-família, vigência 2026) ───────────
  const salaryFamilyExists = await prisma.payrollLegalTable.findFirst({
    where: {
      organizationId: null,
      tableType: 'SALARY_FAMILY',
      effectiveFrom: EFFECTIVE_JAN,
    },
  });

  if (!salaryFamilyExists) {
    await prisma.payrollLegalTable.create({
      data: {
        organizationId: null,
        tableType: 'SALARY_FAMILY',
        effectiveFrom: EFFECTIVE_JAN,
        createdBy: CREATED_BY,
        notes: 'Salário-família 2026 — Portaria MPS',
        scalarValues: {
          create: [
            { key: 'VALUE_PER_CHILD', value: 67.54 },
            { key: 'INCOME_LIMIT', value: 1980.38 },
          ],
        },
      },
    });
  }

  // ─── 4. MINIMUM_WAGE federal 2026 ──────────────────────────────────
  const minimumWageExists = await prisma.payrollLegalTable.findFirst({
    where: {
      organizationId: null,
      tableType: 'MINIMUM_WAGE',
      effectiveFrom: EFFECTIVE_JAN,
    },
  });

  if (!minimumWageExists) {
    await prisma.payrollLegalTable.create({
      data: {
        organizationId: null,
        tableType: 'MINIMUM_WAGE',
        effectiveFrom: EFFECTIVE_JAN,
        createdBy: CREATED_BY,
        notes: 'Salário mínimo federal 2026 — Decreto nº 12.302/2024',
        scalarValues: {
          create: [{ key: 'FEDERAL_MINIMUM', value: 1621.0 }],
        },
      },
    });
  }

  // ─── 5. FUNRURAL pre-April 2026 (Jan-Mar) ─────────────────────────
  const funruralJanExists = await prisma.payrollLegalTable.findFirst({
    where: {
      organizationId: null,
      tableType: 'FUNRURAL',
      effectiveFrom: EFFECTIVE_JAN,
    },
  });

  if (!funruralJanExists) {
    await prisma.payrollLegalTable.create({
      data: {
        organizationId: null,
        tableType: 'FUNRURAL',
        effectiveFrom: EFFECTIVE_JAN,
        createdBy: CREATED_BY,
        notes: 'FUNRURAL 2026 Jan-Mar (antes da correção de alíquota de abril)',
        scalarValues: {
          create: [
            // Pessoa Física (PF)
            { key: 'PF_SOCIAL_SECURITY', value: 1.2 },
            { key: 'PF_RAT', value: 0.1 },
            { key: 'PF_SENAR', value: 0.2 },
            { key: 'PF_TOTAL', value: 1.5 },
            // Pessoa Jurídica (PJ)
            { key: 'PJ_FUNRURAL', value: 1.8 },
            { key: 'PJ_SENAR', value: 0.25 },
            { key: 'PJ_TOTAL', value: 2.05 },
          ],
        },
      },
    });
  }

  // ─── 6. FUNRURAL post-April 2026 (Apr-Dec) ────────────────────────
  const funruralAprExists = await prisma.payrollLegalTable.findFirst({
    where: {
      organizationId: null,
      tableType: 'FUNRURAL',
      effectiveFrom: EFFECTIVE_APR,
    },
  });

  if (!funruralAprExists) {
    await prisma.payrollLegalTable.create({
      data: {
        organizationId: null,
        tableType: 'FUNRURAL',
        effectiveFrom: EFFECTIVE_APR,
        createdBy: CREATED_BY,
        notes: 'FUNRURAL 2026 Abr-Dez (após reajuste de alíquota)',
        scalarValues: {
          create: [
            // Pessoa Física (PF)
            { key: 'PF_SOCIAL_SECURITY', value: 1.32 },
            { key: 'PF_RAT', value: 0.11 },
            { key: 'PF_SENAR', value: 0.2 },
            { key: 'PF_TOTAL', value: 1.63 },
            // Pessoa Jurídica (PJ)
            { key: 'PJ_FUNRURAL', value: 1.98 },
            { key: 'PJ_SENAR', value: 0.25 },
            { key: 'PJ_TOTAL', value: 2.23 },
          ],
        },
      },
    });
  }
}

// Allow running standalone: npx tsx prisma/seed-payroll-2026.ts
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');
  const pgUser = process.env.POSTGRES_USER ?? 'protos';
  const pgPassword = process.env.POSTGRES_PASSWORD ?? 'protos';
  const pgHost = process.env.POSTGRES_HOST ?? 'localhost';
  const pgPort = process.env.POSTGRES_PORT ?? '5450';
  const pgDb = process.env.POSTGRES_DB ?? 'protos_farm';
  const connectionString =
    process.env.DATABASE_URL ??
    `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}?schema=public`;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  seedPayroll2026(prisma)
    .then(() => {
      console.log('Seed payroll 2026 completed successfully.');
    })
    .catch((err) => {
      console.error('Seed payroll 2026 failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
