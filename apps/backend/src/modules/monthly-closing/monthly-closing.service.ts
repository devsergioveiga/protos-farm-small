// ─── Monthly Closing Service ──────────────────────────────────────────────────
// 6-step monthly closing checklist with automated module validation,
// period locking via fiscal-periods service, and admin-only reopening.
//
// Steps:
//  1. Ponto Aprovado — all timesheets APPROVED or LOCKED
//  2. Folha Fechada — payroll run COMPLETED exists
//  3. Depreciacao Processada — depreciation run COMPLETED for period
//  4. Lancamentos Pendentes — no PENDING/ERROR journal postings
//  5. Conciliacao Bancaria — no PENDING bank statement lines
//  6. Balancete Equilibrado — trial balance isBalanced = true

import { prisma } from '../../database/prisma';
import {
  MonthlyClosingError,
  type StepResult,
  type StepResults,
  type MonthlyClosingOutput,
} from './monthly-closing.types';
import { getPendingCounts } from '../auto-posting/auto-posting.service';
import { getTrialBalance } from '../ledger/ledger.service';
import { closePeriod, reopenPeriod } from '../fiscal-periods/fiscal-periods.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ClosingWithPeriod = {
  id: string;
  organizationId: string;
  periodId: string;
  status: string;
  stepResults: unknown;
  completedAt: Date | null;
  completedBy: string | null;
  reopenedAt: Date | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  period: {
    month: number;
    year: number;
    fiscalYearId: string;
  };
};

function formatClosing(c: ClosingWithPeriod): MonthlyClosingOutput {
  return {
    id: c.id,
    organizationId: c.organizationId,
    periodId: c.periodId,
    status: c.status,
    stepResults: (c.stepResults as StepResults) ?? {},
    periodMonth: c.period.month,
    periodYear: c.period.year,
    completedAt: c.completedAt ? c.completedAt.toISOString() : null,
    completedBy: c.completedBy,
    reopenedAt: c.reopenedAt ? c.reopenedAt.toISOString() : null,
    reopenedBy: c.reopenedBy,
    reopenReason: c.reopenReason,
    createdAt: c.createdAt.toISOString(),
  };
}

const PERIOD_SELECT = {
  month: true,
  year: true,
  fiscalYearId: true,
};

const CLOSING_INCLUDE = {
  period: { select: PERIOD_SELECT },
};

// ─── startClosing ─────────────────────────────────────────────────────────────

export async function startClosing(
  organizationId: string,
  periodId: string,
  _initiatedBy: string,
): Promise<{ closing: MonthlyClosingOutput; created: boolean }> {
  // D-04: Return existing IN_PROGRESS closing if already started
  const existing = await prisma.monthlyClosing.findFirst({
    where: { organizationId, periodId, status: 'IN_PROGRESS' },
    include: CLOSING_INCLUDE,
  });

  if (existing) {
    return { closing: formatClosing(existing as ClosingWithPeriod), created: false };
  }

  // Verify period exists and is OPEN
  const period = await prisma.accountingPeriod.findFirst({
    where: { id: periodId, organizationId },
    select: { id: true, status: true, month: true, year: true, fiscalYearId: true },
  });

  if (!period) {
    throw new MonthlyClosingError('Periodo contabil nao encontrado', 'PERIOD_NOT_FOUND', 404);
  }

  if (period.status !== 'OPEN') {
    throw new MonthlyClosingError(
      `Periodo ${period.month}/${period.year} nao esta aberto para fechamento`,
      'PERIOD_NOT_OPEN',
      422,
    );
  }

  const closing = await prisma.monthlyClosing.create({
    data: {
      organizationId,
      periodId,
      status: 'IN_PROGRESS',
      stepResults: {},
    },
    include: CLOSING_INCLUDE,
  });

  return { closing: formatClosing(closing as ClosingWithPeriod), created: true };
}

// ─── getClosing ───────────────────────────────────────────────────────────────

export async function getClosing(
  organizationId: string,
  periodId: string,
): Promise<MonthlyClosingOutput | null> {
  const closing = await prisma.monthlyClosing.findFirst({
    where: { organizationId, periodId },
    include: CLOSING_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  if (!closing) return null;
  return formatClosing(closing as ClosingWithPeriod);
}

// ─── runStepValidation ────────────────────────────────────────────────────────

async function runStepValidation(
  organizationId: string,
  period: { month: number; year: number; fiscalYearId: string },
  stepNumber: number,
): Promise<StepResult> {
  const { month, year } = period;
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);
  const validatedAt = new Date().toISOString();

  if (stepNumber === 1) {
    // Step 1: Ponto Aprovado — timesheets APPROVED or LOCKED
    const pending = await prisma.timesheet.count({
      where: {
        organizationId,
        referenceMonth: firstDayOfMonth,
        status: { notIn: ['APPROVED', 'LOCKED'] },
      },
    });
    if (pending === 0) {
      return { status: 'OK', summary: `Pontos aprovados`, validatedAt };
    }
    return { status: 'FAILED', summary: `${pending} ponto(s) pendente(s) de aprovacao`, validatedAt };
  }

  if (stepNumber === 2) {
    // Step 2: Folha Fechada — payroll run COMPLETED
    const runs = await prisma.payrollRun.findMany({
      where: { organizationId, referenceMonth: firstDayOfMonth },
      select: { status: true },
    });
    if (runs.length > 0 && runs.every((r) => r.status === 'COMPLETED')) {
      return { status: 'OK', summary: `${runs.length} folha(s) fechada(s)`, validatedAt };
    }
    if (runs.length === 0) {
      return { status: 'FAILED', summary: 'Nenhuma folha encontrada para o periodo', validatedAt };
    }
    const inProgress = runs.filter((r) => r.status !== 'COMPLETED').length;
    return { status: 'FAILED', summary: `${inProgress} folha(s) em andamento`, validatedAt };
  }

  if (stepNumber === 3) {
    // Step 3: Depreciacao Processada — NOTE: DepreciationRun.status is String (not enum)
    const depRun = await prisma.depreciationRun.findFirst({
      where: {
        organizationId,
        periodYear: year,
        periodMonth: month,
        status: 'COMPLETED',
      },
      select: { id: true, totalAssets: true },
    });
    if (depRun) {
      return {
        status: 'OK',
        summary: `Depreciacao processada — ${depRun.totalAssets ?? 0} ativo(s)`,
        validatedAt,
      };
    }
    return { status: 'FAILED', summary: 'Nenhum processamento de depreciacao encontrado', validatedAt };
  }

  if (stepNumber === 4) {
    // Step 4: Lancamentos Pendentes — no PENDING/ERROR postings
    const counts = await getPendingCounts(organizationId);
    if (counts.pending === 0 && counts.error === 0) {
      return {
        status: 'OK',
        summary: `Lancamentos processados, 0 pendente(s)`,
        validatedAt,
      };
    }
    return {
      status: 'FAILED',
      summary: `${counts.pending} pendente(s), ${counts.error} erro(s)`,
      validatedAt,
    };
  }

  if (stepNumber === 5) {
    // Step 5: Conciliacao Bancaria — no PENDING bank statement lines
    const totalLines = await prisma.bankStatementLine.count({
      where: {
        organizationId,
        date: { gte: firstDayOfMonth, lte: lastDayOfMonth },
      },
    });

    // Per research pitfall 3: if no bank imports, auto-pass as N/A
    if (totalLines === 0) {
      return {
        status: 'OK',
        summary: 'Nenhum extrato importado — etapa nao aplicavel',
        validatedAt,
      };
    }

    const pendingLines = await prisma.bankStatementLine.count({
      where: {
        organizationId,
        status: 'PENDING',
        date: { gte: firstDayOfMonth, lte: lastDayOfMonth },
      },
    });

    if (pendingLines === 0) {
      return { status: 'OK', summary: `${totalLines} linha(s) conciliada(s)`, validatedAt };
    }
    return {
      status: 'FAILED',
      summary: `${pendingLines} linha(s) pendente(s) de conciliacao`,
      validatedAt,
    };
  }

  if (stepNumber === 6) {
    // Step 6: Balancete Equilibrado — trial balance isBalanced = true
    try {
      const trialBalance = await getTrialBalance(organizationId, {
        fiscalYearId: period.fiscalYearId,
        month,
      });
      if (trialBalance.isBalanced) {
        return { status: 'OK', summary: 'Balancete equilibrado', validatedAt };
      }
      return {
        status: 'FAILED',
        summary: 'Balancete desequilibrado — verificar lancamentos',
        validatedAt,
      };
    } catch {
      return {
        status: 'FAILED',
        summary: 'Erro ao verificar balancete — periodo ou exercicio nao configurado',
        validatedAt,
      };
    }
  }

  throw new MonthlyClosingError(`Etapa ${stepNumber} invalida`, 'INVALID_STEP', 400);
}

// ─── validateStep ─────────────────────────────────────────────────────────────

export async function validateStep(
  organizationId: string,
  closingId: string,
  stepNumber: 1 | 2 | 3 | 4 | 5 | 6,
): Promise<StepResult> {
  const closing = await prisma.monthlyClosing.findFirst({
    where: { id: closingId, organizationId },
    include: CLOSING_INCLUDE,
  });

  if (!closing) {
    throw new MonthlyClosingError('Fechamento nao encontrado', 'NOT_FOUND', 404);
  }

  // D-03: Step N requires step N-1 to be OK
  if (stepNumber > 1) {
    const prevStepKey = `step${stepNumber - 1}` as keyof StepResults;
    const prevSteps = (closing.stepResults as StepResults) ?? {};
    const prevStep = prevSteps[prevStepKey];
    if (!prevStep || prevStep.status !== 'OK') {
      throw new MonthlyClosingError(
        `Etapa ${stepNumber - 1} deve ser validada com sucesso antes da etapa ${stepNumber}`,
        'STEP_DEPENDENCY',
        422,
      );
    }
  }

  const period = (closing as ClosingWithPeriod).period;
  const result = await runStepValidation(organizationId, period, stepNumber);

  // Persist result to stepResults JSON field
  const currentSteps = (closing.stepResults as StepResults) ?? {};
  const stepKey = `step${stepNumber}` as keyof StepResults;
  const updatedSteps = { ...currentSteps, [stepKey]: result };

  await prisma.monthlyClosing.update({
    where: { id: closingId },
    data: { stepResults: updatedSteps },
  });

  return result;
}

// ─── completeClosing ──────────────────────────────────────────────────────────

export async function completeClosing(
  organizationId: string,
  closingId: string,
  userId: string,
): Promise<MonthlyClosingOutput> {
  const closing = await prisma.monthlyClosing.findFirst({
    where: { id: closingId, organizationId },
    include: CLOSING_INCLUDE,
  });

  if (!closing) {
    throw new MonthlyClosingError('Fechamento nao encontrado', 'NOT_FOUND', 404);
  }

  const steps = (closing.stepResults as StepResults) ?? {};

  // Verify all 6 steps have status OK
  for (let i = 1; i <= 6; i++) {
    const stepKey = `step${i}` as keyof StepResults;
    const step = steps[stepKey];
    if (!step || step.status !== 'OK') {
      throw new MonthlyClosingError(
        `Todas as 6 etapas devem estar OK antes de concluir o fechamento. Etapa ${i} esta ${step?.status ?? 'pendente'}`,
        'INCOMPLETE_STEPS',
        422,
      );
    }
  }

  // Close the accounting period
  await closePeriod(prisma, organizationId, closing.periodId, { closedBy: userId });

  // Update closing status
  const updated = await prisma.monthlyClosing.update({
    where: { id: closingId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy: userId,
    },
    include: CLOSING_INCLUDE,
  });

  return formatClosing(updated as ClosingWithPeriod);
}

// ─── reopenClosing ────────────────────────────────────────────────────────────

export async function reopenClosing(
  organizationId: string,
  closingId: string,
  userId: string,
  reason: string,
): Promise<MonthlyClosingOutput> {
  const closing = await prisma.monthlyClosing.findFirst({
    where: { id: closingId, organizationId },
    include: CLOSING_INCLUDE,
  });

  if (!closing) {
    throw new MonthlyClosingError('Fechamento nao encontrado', 'NOT_FOUND', 404);
  }

  if (closing.status !== 'COMPLETED') {
    throw new MonthlyClosingError(
      'Apenas fechamentos COMPLETED podem ser reabertos',
      'INVALID_STATUS',
      422,
    );
  }

  if (!reason || reason.trim() === '') {
    throw new MonthlyClosingError('Motivo de reabertura e obrigatorio', 'REASON_REQUIRED', 422);
  }

  // Reopen the accounting period
  await reopenPeriod(prisma, organizationId, closing.periodId, {
    reopenedBy: userId,
    reopenReason: reason,
  });

  // Update closing status
  const updated = await prisma.monthlyClosing.update({
    where: { id: closingId },
    data: {
      status: 'REOPENED',
      reopenedAt: new Date(),
      reopenedBy: userId,
      reopenReason: reason,
    },
    include: CLOSING_INCLUDE,
  });

  return formatClosing(updated as ClosingWithPeriod);
}
