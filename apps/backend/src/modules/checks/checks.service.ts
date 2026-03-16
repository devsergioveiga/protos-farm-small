/* eslint-disable @typescript-eslint/no-explicit-any */
import { Money } from '@protos-farm/shared';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  CheckError,
  VALID_TRANSITIONS,
  type CreateCheckInput,
  type ListChecksQuery,
  type CheckOutput,
} from './checks.types';

// ─── Helpers ─────────────────────────────────────────────────────────

function toCheckOutput(row: any): CheckOutput {
  return {
    id: row.id as string,
    type: row.type as string,
    status: row.status as string,
    checkNumber: row.checkNumber as string,
    amount: Money.fromPrismaDecimal(row.amount).toNumber(),
    bankAccountId: row.bankAccountId as string,
    bankAccountName: (row.bankAccount?.name ?? '') as string,
    issueDate: (row.issueDate as Date).toISOString(),
    deliveryDate: row.deliveryDate ? (row.deliveryDate as Date).toISOString() : null,
    expectedCompensationDate: row.expectedCompensationDate
      ? (row.expectedCompensationDate as Date).toISOString()
      : null,
    compensationDate: row.compensationDate ? (row.compensationDate as Date).toISOString() : null,
    payeeName: row.payeeName as string,
    description: (row.description as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

const CHECK_INCLUDE = {
  bankAccount: { select: { id: true, name: true } },
};

// ─── validateTransition ──────────────────────────────────────────────

export function validateTransition(currentStatus: string, targetStatus: string): void {
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw new CheckError(`Transicao de status invalida: ${currentStatus} -> ${targetStatus}`, 422);
  }
}

// ─── createCheck ────────────────────────────────────────────────────

export async function createCheck(ctx: RlsContext, input: CreateCheckInput): Promise<CheckOutput> {
  const {
    type,
    checkNumber,
    amount,
    bankAccountId,
    issueDate,
    deliveryDate,
    expectedCompensationDate,
    payeeName,
    description,
    notes,
  } = input;

  if (amount <= 0) {
    throw new CheckError('Valor do cheque deve ser maior que zero', 400);
  }
  if (checkNumber.length > 20) {
    throw new CheckError('Número do cheque deve ter no máximo 20 caracteres', 400);
  }
  if (payeeName.length > 100) {
    throw new CheckError('Nome do beneficiário deve ter no máximo 100 caracteres', 400);
  }

  const check = await withRlsContext(ctx, async (tx) => {
    // Validate bankAccountId exists and belongs to organization
    const account = await (tx as any).bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: ctx.organizationId, isActive: true },
    });
    if (!account) {
      throw new CheckError('Conta bancária não encontrada ou inativa', 404);
    }

    const created = await (tx as any).check.create({
      data: {
        organizationId: ctx.organizationId,
        type,
        status: 'EMITIDO',
        checkNumber,
        amount: Money(amount).toDecimal(),
        bankAccountId,
        issueDate: new Date(issueDate),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        expectedCompensationDate: expectedCompensationDate
          ? new Date(expectedCompensationDate)
          : null,
        payeeName,
        description: description ?? null,
        notes: notes ?? null,
      },
      include: CHECK_INCLUDE,
    });

    return created;
  });

  return toCheckOutput(check);
}

// ─── listChecks ─────────────────────────────────────────────────────

export async function listChecks(
  ctx: RlsContext,
  query: ListChecksQuery = {},
): Promise<CheckOutput[]> {
  const { status, type, startDate, endDate } = query;

  const where: any = { organizationId: ctx.organizationId };

  if (status) {
    const statuses = status.split(',').map((s) => s.trim());
    where.status = { in: statuses };
  }
  if (type) {
    where.type = type;
  }
  if (startDate || endDate) {
    where.issueDate = {};
    if (startDate) {
      where.issueDate.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      where.issueDate.lte = end;
    }
  }

  const checks = await withRlsContext(ctx, async (tx) => {
    return (tx as any).check.findMany({
      where,
      include: CHECK_INCLUDE,
      orderBy: { issueDate: 'desc' },
    });
  });

  return checks.map(toCheckOutput);
}

// ─── getCheck ────────────────────────────────────────────────────────

export async function getCheck(ctx: RlsContext, checkId: string): Promise<CheckOutput> {
  const check = await withRlsContext(ctx, async (tx) => {
    return (tx as any).check.findFirst({
      where: { id: checkId, organizationId: ctx.organizationId },
      include: CHECK_INCLUDE,
    });
  });

  if (!check) {
    throw new CheckError('Cheque não encontrado', 404);
  }

  return toCheckOutput(check);
}

// ─── markACompensar ──────────────────────────────────────────────────

export async function markACompensar(ctx: RlsContext, checkId: string): Promise<CheckOutput> {
  const check = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).check.findFirst({
      where: { id: checkId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new CheckError('Cheque não encontrado', 404);
    }

    validateTransition(existing.status, 'A_COMPENSAR');

    return (tx as any).check.update({
      where: { id: checkId },
      data: {
        status: 'A_COMPENSAR',
        deliveryDate: existing.deliveryDate ?? new Date(),
      },
      include: CHECK_INCLUDE,
    });
  });

  return toCheckOutput(check);
}

// ─── compensateCheck ─────────────────────────────────────────────────

export async function compensateCheck(
  ctx: RlsContext,
  checkId: string,
  compensationDate?: string,
): Promise<CheckOutput> {
  const check = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).check.findFirst({
      where: { id: checkId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new CheckError('Cheque não encontrado', 404);
    }

    validateTransition(existing.status, 'COMPENSADO');

    const resolvedDate = compensationDate ? new Date(compensationDate) : new Date();
    const amount = Money.fromPrismaDecimal(existing.amount);

    // EMITIDO check: we paid someone -> DEBIT our account
    // RECEBIDO check: we received payment -> CREDIT our account
    const transactionType = existing.type === 'EMITIDO' ? 'DEBIT' : 'CREDIT';

    // Create FinancialTransaction
    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId: existing.bankAccountId,
        type: transactionType,
        amount: amount.toDecimal(),
        description: `Compensação de cheque ${existing.checkNumber} - ${existing.payeeName}`,
        referenceType: 'CHECK_COMPENSATION',
        referenceId: existing.id,
        transactionDate: resolvedDate,
      },
    });

    // Update BankAccountBalance atomically
    if (existing.type === 'EMITIDO') {
      await (tx as any).bankAccountBalance.update({
        where: { bankAccountId: existing.bankAccountId },
        data: { currentBalance: { decrement: amount.toDecimal() } },
      });
    } else {
      await (tx as any).bankAccountBalance.update({
        where: { bankAccountId: existing.bankAccountId },
        data: { currentBalance: { increment: amount.toDecimal() } },
      });
    }

    // Update check status
    return (tx as any).check.update({
      where: { id: checkId },
      data: {
        status: 'COMPENSADO',
        compensationDate: resolvedDate,
      },
      include: CHECK_INCLUDE,
    });
  });

  return toCheckOutput(check);
}

// ─── returnCheck ─────────────────────────────────────────────────────

export async function returnCheck(ctx: RlsContext, checkId: string): Promise<CheckOutput> {
  const check = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).check.findFirst({
      where: { id: checkId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new CheckError('Cheque não encontrado', 404);
    }

    validateTransition(existing.status, 'DEVOLVIDO');

    return (tx as any).check.update({
      where: { id: checkId },
      data: { status: 'DEVOLVIDO' },
      include: CHECK_INCLUDE,
    });
  });

  return toCheckOutput(check);
}

// ─── resubmitCheck ───────────────────────────────────────────────────

export async function resubmitCheck(
  ctx: RlsContext,
  checkId: string,
  expectedCompensationDate?: string,
): Promise<CheckOutput> {
  const check = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).check.findFirst({
      where: { id: checkId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new CheckError('Cheque não encontrado', 404);
    }

    validateTransition(existing.status, 'A_COMPENSAR');

    return (tx as any).check.update({
      where: { id: checkId },
      data: {
        status: 'A_COMPENSAR',
        expectedCompensationDate: expectedCompensationDate
          ? new Date(expectedCompensationDate)
          : existing.expectedCompensationDate,
      },
      include: CHECK_INCLUDE,
    });
  });

  return toCheckOutput(check);
}

// ─── cancelCheck ─────────────────────────────────────────────────────

export async function cancelCheck(ctx: RlsContext, checkId: string): Promise<CheckOutput> {
  const check = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).check.findFirst({
      where: { id: checkId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new CheckError('Cheque não encontrado', 404);
    }

    validateTransition(existing.status, 'CANCELADO');

    return (tx as any).check.update({
      where: { id: checkId },
      data: { status: 'CANCELADO' },
      include: CHECK_INCLUDE,
    });
  });

  return toCheckOutput(check);
}

// ─── getAlertCount ───────────────────────────────────────────────────

export async function getAlertCount(ctx: RlsContext): Promise<{ count: number }> {
  const count = await withRlsContext(ctx, async (tx) => {
    return (tx as any).check.count({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ['A_COMPENSAR', 'DEVOLVIDO'] },
      },
    });
  });

  return { count };
}

// ─── getAccountingBalanceData ─────────────────────────────────────────

export async function getAccountingBalanceData(
  ctx: RlsContext,
  farmId?: string,
): Promise<{ pendingEmitidos: number; pendingRecebidos: number }> {
  const where: any = {
    organizationId: ctx.organizationId,
    status: 'A_COMPENSAR',
  };

  if (farmId) {
    where.bankAccount = { farms: { some: { farmId } } };
  }

  const checks = await withRlsContext(ctx, async (tx) => {
    return (tx as any).check.findMany({
      where,
      select: { type: true, amount: true },
    });
  });

  let pendingEmitidos = Money(0);
  let pendingRecebidos = Money(0);

  for (const check of checks) {
    const amount = Money.fromPrismaDecimal(check.amount);
    if (check.type === 'EMITIDO') {
      pendingEmitidos = pendingEmitidos.add(amount);
    } else {
      pendingRecebidos = pendingRecebidos.add(amount);
    }
  }

  return {
    pendingEmitidos: pendingEmitidos.toNumber(),
    pendingRecebidos: pendingRecebidos.toNumber(),
  };
}
