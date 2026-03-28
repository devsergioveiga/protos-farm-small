// ─── Fiscal Periods Service ───────────────────────────────────────────────────
// COA-04: Fiscal year CRUD with auto-generated monthly periods, period state
// machine (OPEN/CLOSED/BLOCKED), and audit trail for period lifecycle.

import type { PrismaClient } from '@prisma/client';
import { eachMonthOfInterval, getMonth, getYear, parseISO } from 'date-fns';
import {
  FiscalPeriodError,
  type CreateFiscalYearInput,
  type ClosePeriodInput,
  type ReopenPeriodInput,
  type FiscalYearOutput,
  type AccountingPeriodOutput,
} from './fiscal-periods.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapPeriod(p: AccountingPeriodOutput): AccountingPeriodOutput {
  return p;
}

// ─── createFiscalYear ─────────────────────────────────────────────────────────

export async function createFiscalYear(
  prisma: PrismaClient,
  organizationId: string,
  input: CreateFiscalYearInput,
): Promise<FiscalYearOutput> {
  const startDate = parseISO(input.startDate);
  const endDate = parseISO(input.endDate);

  if (endDate <= startDate) {
    throw new FiscalPeriodError(
      'Data de fim deve ser posterior à data de inicio',
      'OVERLAPPING_YEAR',
      422,
    );
  }

  // Check for overlapping fiscal years for this org
  const overlapping = await prisma.fiscalYear.findFirst({
    where: {
      organizationId,
      OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
    },
  });

  if (overlapping) {
    throw new FiscalPeriodError(
      'Ja existe um exercicio fiscal com datas sobrepostas para esta organizacao',
      'OVERLAPPING_YEAR',
      409,
    );
  }

  // Create fiscal year
  const fiscalYear = await prisma.fiscalYear.create({
    data: {
      organizationId,
      name: input.name,
      startDate,
      endDate,
      isActive: true,
    },
  });

  // Auto-generate monthly periods for each month in the range
  const months = eachMonthOfInterval({ start: startDate, end: endDate });

  const periodsData = months.map((d) => ({
    organizationId,
    fiscalYearId: fiscalYear.id,
    month: getMonth(d) + 1, // date-fns months are 0-indexed
    year: getYear(d),
    status: 'OPEN' as const,
  }));

  await prisma.accountingPeriod.createMany({ data: periodsData });

  // Return fiscal year with periods
  const periods = await prisma.accountingPeriod.findMany({
    where: { fiscalYearId: fiscalYear.id },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  return {
    ...fiscalYear,
    periods: periods.map(mapPeriod),
  } as FiscalYearOutput;
}

// ─── getFiscalYears ───────────────────────────────────────────────────────────

export async function getFiscalYears(
  prisma: PrismaClient,
  organizationId: string,
): Promise<FiscalYearOutput[]> {
  const years = await prisma.fiscalYear.findMany({
    where: { organizationId },
    include: {
      accountingPeriods: {
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      },
    },
    orderBy: { startDate: 'desc' },
  });

  return years.map((y) => ({
    ...y,
    periods: y.accountingPeriods.map(mapPeriod),
  })) as FiscalYearOutput[];
}

// ─── closePeriod ─────────────────────────────────────────────────────────────

export async function closePeriod(
  prisma: PrismaClient,
  organizationId: string,
  periodId: string,
  input: ClosePeriodInput,
): Promise<AccountingPeriodOutput> {
  const period = await prisma.accountingPeriod.findFirst({
    where: { id: periodId, organizationId },
  });

  if (!period) {
    throw new FiscalPeriodError('Periodo contabil nao encontrado', 'PERIOD_NOT_FOUND', 404);
  }

  if (period.status === 'CLOSED') {
    throw new FiscalPeriodError('Periodo ja esta fechado', 'INVALID_TRANSITION', 422);
  }

  if (period.status === 'BLOCKED') {
    throw new FiscalPeriodError(
      'Periodo bloqueado — nao e possivel fechar',
      'INVALID_TRANSITION',
      422,
    );
  }

  const updated = await prisma.accountingPeriod.update({
    where: { id: periodId },
    data: {
      status: 'CLOSED' as const,
      closedAt: new Date(),
      closedBy: input.closedBy,
    },
  });

  return updated as AccountingPeriodOutput;
}

// ─── reopenPeriod ─────────────────────────────────────────────────────────────

export async function reopenPeriod(
  prisma: PrismaClient,
  organizationId: string,
  periodId: string,
  input: ReopenPeriodInput,
): Promise<AccountingPeriodOutput> {
  const period = await prisma.accountingPeriod.findFirst({
    where: { id: periodId, organizationId },
  });

  if (!period) {
    throw new FiscalPeriodError('Periodo contabil nao encontrado', 'PERIOD_NOT_FOUND', 404);
  }

  if (period.status === 'OPEN') {
    throw new FiscalPeriodError('Periodo ja esta aberto', 'INVALID_TRANSITION', 422);
  }

  if (period.status === 'BLOCKED') {
    throw new FiscalPeriodError(
      'Periodo bloqueado — nao e possivel reabrir',
      'INVALID_TRANSITION',
      422,
    );
  }

  if (!input.reopenReason || input.reopenReason.trim() === '') {
    throw new FiscalPeriodError('Motivo de reabertura e obrigatorio', 'REASON_REQUIRED', 422);
  }

  const updated = await prisma.accountingPeriod.update({
    where: { id: periodId },
    data: {
      status: 'OPEN' as const,
      reopenedAt: new Date(),
      reopenedBy: input.reopenedBy,
      reopenReason: input.reopenReason,
    },
  });

  return updated as AccountingPeriodOutput;
}

// ─── blockPeriod ─────────────────────────────────────────────────────────────

export async function blockPeriod(
  prisma: PrismaClient,
  organizationId: string,
  periodId: string,
): Promise<AccountingPeriodOutput> {
  const period = await prisma.accountingPeriod.findFirst({
    where: { id: periodId, organizationId },
  });

  if (!period) {
    throw new FiscalPeriodError('Periodo contabil nao encontrado', 'PERIOD_NOT_FOUND', 404);
  }

  if (period.status === 'BLOCKED') {
    throw new FiscalPeriodError('Periodo ja esta bloqueado', 'INVALID_TRANSITION', 422);
  }

  const updated = await prisma.accountingPeriod.update({
    where: { id: periodId },
    data: { status: 'BLOCKED' as const },
  });

  return updated as AccountingPeriodOutput;
}

// ─── getPeriodForDate ─────────────────────────────────────────────────────────

export async function getPeriodForDate(
  prisma: PrismaClient,
  organizationId: string,
  date: Date,
): Promise<AccountingPeriodOutput | null> {
  const month = getMonth(date) + 1; // 1-indexed
  const year = getYear(date);

  const period = await prisma.accountingPeriod.findFirst({
    where: {
      organizationId,
      month,
      year,
      fiscalYear: { isActive: true },
    },
    include: { fiscalYear: false },
  });

  if (!period) return null;
  return period as AccountingPeriodOutput;
}
