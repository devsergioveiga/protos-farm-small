import { Money, generateInstallments, validateCostCenterItems } from '@protos-farm/shared';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  ReceivableError,
  type ReceivableStatus,
  type ReceivableCategory,
  type CreateReceivableInput,
  type UpdateReceivableInput,
  type SettleReceivableInput,
  type RenegotiateInput,
  type ListReceivablesQuery,
  type ReceivableOutput,
  type ReceivableInstallmentOutput,
  type ReceivableCostCenterItemOutput,
  type AgingResponse,
  type AgingBucket,
  type AgingBucketResult,
} from './receivables.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ─────────────────────────────────────────────────────────

function toInstallmentOutput(row: any): ReceivableInstallmentOutput {
  return {
    id: row.id as string,
    number: row.number as number,
    amount: Money.fromPrismaDecimal(row.amount).toNumber(),
    dueDate: (row.dueDate as Date).toISOString(),
    status: row.status as ReceivableStatus,
    receivedAt: row.receivedAt ? (row.receivedAt as Date).toISOString() : null,
    amountReceived:
      row.amountReceived != null ? Money.fromPrismaDecimal(row.amountReceived).toNumber() : null,
  };
}

function toCostCenterItemOutput(row: any): ReceivableCostCenterItemOutput {
  return {
    id: row.id as string,
    costCenterId: row.costCenterId as string,
    farmId: row.farmId as string,
    allocMode: row.allocMode as 'PERCENTAGE' | 'FIXED_VALUE',
    percentage: row.percentage != null ? Money.fromPrismaDecimal(row.percentage).toNumber() : null,
    fixedAmount:
      row.fixedAmount != null ? Money.fromPrismaDecimal(row.fixedAmount).toNumber() : null,
  };
}

function toReceivableOutput(row: any): ReceivableOutput {
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    farmId: row.farmId as string,
    producerId: (row.producerId as string) ?? null,
    clientName: row.clientName as string,
    category: row.category as ReceivableCategory,
    description: row.description as string,
    totalAmount: Money.fromPrismaDecimal(row.totalAmount).toNumber(),
    dueDate: (row.dueDate as Date).toISOString(),
    status: row.status as ReceivableStatus,
    documentNumber: (row.documentNumber as string) ?? null,
    nfeKey: (row.nfeKey as string) ?? null,
    funruralRate:
      row.funruralRate != null ? Money.fromPrismaDecimal(row.funruralRate).toNumber() : null,
    funruralAmount:
      row.funruralAmount != null ? Money.fromPrismaDecimal(row.funruralAmount).toNumber() : null,
    installmentCount: row.installmentCount as number,
    receivedAt: row.receivedAt ? (row.receivedAt as Date).toISOString() : null,
    amountReceived:
      row.amountReceived != null ? Money.fromPrismaDecimal(row.amountReceived).toNumber() : null,
    bankAccountId: (row.bankAccountId as string) ?? null,
    interestAmount:
      row.interestAmount != null ? Money.fromPrismaDecimal(row.interestAmount).toNumber() : null,
    fineAmount: row.fineAmount != null ? Money.fromPrismaDecimal(row.fineAmount).toNumber() : null,
    discountAmount:
      row.discountAmount != null ? Money.fromPrismaDecimal(row.discountAmount).toNumber() : null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
    installments: (row.installments ?? []).map(toInstallmentOutput),
    costCenterItems: (row.costCenterItems ?? []).map(toCostCenterItemOutput),
  };
}

const RECEIVABLE_INCLUDE = {
  installments: { orderBy: { number: 'asc' } },
  costCenterItems: true,
};

// ─── createReceivable ────────────────────────────────────────────────

export async function createReceivable(
  ctx: RlsContext,
  input: CreateReceivableInput,
): Promise<ReceivableOutput> {
  const {
    farmId,
    producerId,
    clientName,
    category,
    description,
    totalAmount,
    dueDate,
    documentNumber,
    nfeKey,
    funruralRate,
    installmentCount = 1,
    costCenterItems,
    recurrenceFrequency,
    recurrenceEndDate,
    bankAccountId,
    notes,
  } = input;

  // Validate nfeKey length if provided
  if (nfeKey !== undefined && nfeKey !== null && nfeKey.trim().length !== 44) {
    throw new ReceivableError('Chave NF-e deve ter exatamente 44 caracteres', 400);
  }

  // Validate cost center items
  const totalMoney = Money(totalAmount);
  if (costCenterItems && costCenterItems.length > 0) {
    validateCostCenterItems(totalMoney, costCenterItems);
  }

  // Compute FUNRURAL at creation time (stored, not computed at runtime — Research Pitfall 3)
  let funruralAmountValue: number | null = null;
  if (funruralRate !== undefined && funruralRate !== null) {
    funruralAmountValue = totalMoney.multiply(funruralRate).toNumber();
  }

  // Generate installments
  const firstDueDate = new Date(dueDate);
  const installments = generateInstallments(totalMoney, installmentCount, firstDueDate);

  const receivable = await withRlsContext(ctx, async (tx) => {
    // (a) Create Receivable
    const created = await (tx as any).receivable.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        producerId: producerId ?? null,
        clientName,
        category,
        description,
        totalAmount: totalMoney.toDecimal(),
        dueDate: firstDueDate,
        documentNumber: documentNumber ?? null,
        nfeKey: nfeKey ?? null,
        funruralRate: funruralRate != null ? funruralRate : null,
        funruralAmount: funruralAmountValue != null ? Money(funruralAmountValue).toDecimal() : null,
        installmentCount,
        recurrenceFrequency: recurrenceFrequency ?? null,
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        bankAccountId: bankAccountId ?? null,
        notes: notes ?? null,
      },
    });

    // (b) Create ReceivableInstallment[]
    await (tx as any).receivableInstallment.createMany({
      data: installments.map((inst) => ({
        receivableId: created.id,
        number: inst.number,
        amount: inst.amount.toDecimal(),
        dueDate: inst.dueDate,
      })),
    });

    // (c) Create ReceivableCostCenterItem[]
    if (costCenterItems && costCenterItems.length > 0) {
      await (tx as any).receivableCostCenterItem.createMany({
        data: costCenterItems.map((item) => ({
          receivableId: created.id,
          costCenterId: item.costCenterId,
          farmId: item.farmId,
          allocMode: item.allocMode,
          percentage: item.percentage != null ? item.percentage : null,
          fixedAmount: item.fixedAmount != null ? Money(item.fixedAmount).toDecimal() : null,
        })),
      });
    }

    return (tx as any).receivable.findUnique({
      where: { id: created.id },
      include: RECEIVABLE_INCLUDE,
    });
  });

  return toReceivableOutput(receivable);
}

// ─── listReceivables ─────────────────────────────────────────────────

export async function listReceivables(
  ctx: RlsContext,
  query: ListReceivablesQuery = {},
): Promise<{ data: ReceivableOutput[]; total: number }> {
  const { farmId, status, category, startDate, endDate, search, page = 1, limit = 50 } = query;

  const where: any = { organizationId: ctx.organizationId };

  if (farmId) where.farmId = farmId;
  if (status) where.status = status;
  if (category) where.category = category;
  if (startDate || endDate) {
    where.dueDate = {};
    if (startDate) where.dueDate.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      where.dueDate.lte = end;
    }
  }
  if (search) {
    where.OR = [
      { clientName: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { documentNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [rows, total] = await withRlsContext(ctx, async (tx) => {
    return Promise.all([
      (tx as any).receivable.findMany({
        where,
        include: RECEIVABLE_INCLUDE,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      (tx as any).receivable.count({ where }),
    ]);
  });

  return {
    data: rows.map(toReceivableOutput),
    total: total as number,
  };
}

// ─── getReceivable ───────────────────────────────────────────────────

export async function getReceivable(ctx: RlsContext, id: string): Promise<ReceivableOutput> {
  const row = await withRlsContext(ctx, async (tx) => {
    return (tx as any).receivable.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: RECEIVABLE_INCLUDE,
    });
  });

  if (!row) {
    throw new ReceivableError('Conta a receber não encontrada', 404);
  }

  return toReceivableOutput(row);
}

// ─── updateReceivable ────────────────────────────────────────────────

export async function updateReceivable(
  ctx: RlsContext,
  id: string,
  input: UpdateReceivableInput,
): Promise<ReceivableOutput> {
  const row = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).receivable.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new ReceivableError('Conta a receber não encontrada', 404);
    }
    if (existing.status !== 'PENDING') {
      throw new ReceivableError('Apenas contas com status PENDING podem ser editadas', 400);
    }

    const {
      costCenterItems,
      nfeKey,
      funruralRate,
      totalAmount,
      installmentCount,
      dueDate,
      ...rest
    } = input;

    // Validate nfeKey if changing
    if (nfeKey !== undefined && nfeKey !== null && nfeKey.trim().length !== 44) {
      throw new ReceivableError('Chave NF-e deve ter exatamente 44 caracteres', 400);
    }

    const newTotal =
      totalAmount !== undefined
        ? totalAmount
        : Money.fromPrismaDecimal(existing.totalAmount).toNumber();
    const totalMoney = Money(newTotal);

    // Recompute funruralAmount if rate or amount changes
    let funruralAmountDecimal: any = undefined;
    if (funruralRate !== undefined || totalAmount !== undefined) {
      const rate =
        funruralRate !== undefined
          ? funruralRate
          : existing.funruralRate
            ? Money.fromPrismaDecimal(existing.funruralRate).toNumber()
            : null;
      funruralAmountDecimal = rate != null ? totalMoney.multiply(rate).toDecimal() : null;
    }

    // Validate cost center items if provided
    if (costCenterItems && costCenterItems.length > 0) {
      validateCostCenterItems(totalMoney, costCenterItems);
    }

    // Build update data
    const updateData: any = { ...rest };
    if (nfeKey !== undefined) updateData.nfeKey = nfeKey;
    if (funruralRate !== undefined) updateData.funruralRate = funruralRate;
    if (funruralAmountDecimal !== undefined) updateData.funruralAmount = funruralAmountDecimal;
    if (totalAmount !== undefined) updateData.totalAmount = totalMoney.toDecimal();
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);

    await (tx as any).receivable.update({
      where: { id },
      data: updateData,
    });

    // Regenerate installments if totalAmount or installmentCount changes
    const newInstallmentCount =
      installmentCount !== undefined ? installmentCount : (existing.installmentCount as number);
    const newDueDate = dueDate ? new Date(dueDate) : (existing.dueDate as Date);

    if (totalAmount !== undefined || installmentCount !== undefined || dueDate !== undefined) {
      const installments = generateInstallments(totalMoney, newInstallmentCount, newDueDate);
      await (tx as any).receivableInstallment.deleteMany({ where: { receivableId: id } });
      await (tx as any).receivableInstallment.createMany({
        data: installments.map((inst) => ({
          receivableId: id,
          number: inst.number,
          amount: inst.amount.toDecimal(),
          dueDate: inst.dueDate,
        })),
      });
    }

    // Replace cost center items if provided
    if (costCenterItems !== undefined) {
      await (tx as any).receivableCostCenterItem.deleteMany({ where: { receivableId: id } });
      if (costCenterItems.length > 0) {
        await (tx as any).receivableCostCenterItem.createMany({
          data: costCenterItems.map((item) => ({
            receivableId: id,
            costCenterId: item.costCenterId,
            farmId: item.farmId,
            allocMode: item.allocMode,
            percentage: item.percentage != null ? item.percentage : null,
            fixedAmount: item.fixedAmount != null ? Money(item.fixedAmount).toDecimal() : null,
          })),
        });
      }
    }

    return (tx as any).receivable.findUnique({
      where: { id },
      include: RECEIVABLE_INCLUDE,
    });
  });

  return toReceivableOutput(row);
}

// ─── deleteReceivable ────────────────────────────────────────────────

export async function deleteReceivable(ctx: RlsContext, id: string): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).receivable.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new ReceivableError('Conta a receber não encontrada', 404);
    }
    if (existing.status !== 'PENDING') {
      throw new ReceivableError('Apenas contas com status PENDING podem ser canceladas', 400);
    }
    await (tx as any).receivable.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  });
}

// ─── settleReceivable ────────────────────────────────────────────────

export async function settleReceivable(
  ctx: RlsContext,
  receivableId: string,
  input: SettleReceivableInput,
): Promise<ReceivableOutput> {
  const { receivedAt, amount, bankAccountId, interestAmount, fineAmount, discountAmount } = input;

  const row = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).receivable.findFirst({
      where: { id: receivableId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new ReceivableError('Conta a receber não encontrada', 404);
    }
    if (existing.status === 'RECEIVED') {
      throw new ReceivableError('Esta conta a receber já foi liquidada', 400);
    }
    if (existing.status === 'CANCELLED') {
      throw new ReceivableError('Conta a receber cancelada não pode ser liquidada', 400);
    }
    if (existing.status === 'RENEGOTIATED') {
      throw new ReceivableError('Conta a receber renegociada não pode ser liquidada', 400);
    }

    // Effective amount received = amount + interest + fine - discount
    const effectiveAmount = Money(amount)
      .add(Money(interestAmount ?? 0))
      .add(Money(fineAmount ?? 0))
      .subtract(Money(discountAmount ?? 0));

    // (a) Update Receivable status to RECEIVED
    await (tx as any).receivable.update({
      where: { id: receivableId },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date(receivedAt),
        amountReceived: effectiveAmount.toDecimal(),
        bankAccountId,
        interestAmount: interestAmount != null ? Money(interestAmount).toDecimal() : null,
        fineAmount: fineAmount != null ? Money(fineAmount).toDecimal() : null,
        discountAmount: discountAmount != null ? Money(discountAmount).toDecimal() : null,
      },
    });

    // (b) INCREMENT bank account balance (money comes IN — opposite of payables DEBIT)
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId },
      data: {
        currentBalance: {
          increment: effectiveAmount.toDecimal(),
        },
      },
    });

    // (c) Create FinancialTransaction type=CREDIT
    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        type: 'CREDIT',
        amount: effectiveAmount.toDecimal(),
        description: `Recebimento CR #${receivableId.slice(0, 8)}`,
        referenceType: 'RECEIVABLE',
        referenceId: receivableId,
        transactionDate: new Date(receivedAt),
      },
    });

    return (tx as any).receivable.findUnique({
      where: { id: receivableId },
      include: RECEIVABLE_INCLUDE,
    });
  });

  return toReceivableOutput(row);
}

// ─── reverseReceivable ───────────────────────────────────────────────

export async function reverseReceivable(
  ctx: RlsContext,
  receivableId: string,
): Promise<ReceivableOutput> {
  const row = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).receivable.findFirst({
      where: { id: receivableId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new ReceivableError('Conta a receber não encontrada', 404);
    }
    if (existing.status !== 'RECEIVED') {
      throw new ReceivableError('Apenas contas liquidadas podem ser estornadas', 400);
    }

    const amountReceived = Money.fromPrismaDecimal(existing.amountReceived ?? 0);
    const bankAccountId = existing.bankAccountId as string;

    // (a) Reset Receivable to PENDING
    await (tx as any).receivable.update({
      where: { id: receivableId },
      data: {
        status: 'PENDING',
        receivedAt: null,
        amountReceived: null,
        interestAmount: null,
        fineAmount: null,
        discountAmount: null,
      },
    });

    // (b) DECREMENT bank balance (reverse the credit)
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId },
      data: {
        currentBalance: {
          decrement: amountReceived.toDecimal(),
        },
      },
    });

    // (c) Create DEBIT FinancialTransaction for the reversal
    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        type: 'DEBIT',
        amount: amountReceived.toDecimal(),
        description: `Estorno CR #${receivableId.slice(0, 8)}`,
        referenceType: 'RECEIVABLE',
        referenceId: receivableId,
        transactionDate: new Date(),
      },
    });

    return (tx as any).receivable.findUnique({
      where: { id: receivableId },
      include: RECEIVABLE_INCLUDE,
    });
  });

  return toReceivableOutput(row);
}

// ─── renegotiateReceivable ───────────────────────────────────────────

export async function renegotiateReceivable(
  ctx: RlsContext,
  id: string,
  input: RenegotiateInput,
): Promise<ReceivableOutput> {
  const { newDueDate, newAmount, notes } = input;

  const newRow = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).receivable.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { costCenterItems: true },
    });
    if (!existing) {
      throw new ReceivableError('Conta a receber não encontrada', 404);
    }
    if (!['PENDING', 'OVERDUE'].includes(existing.status as string)) {
      throw new ReceivableError('Apenas contas PENDING ou OVERDUE podem ser renegociadas', 400);
    }

    // (a) Mark original as RENEGOTIATED
    await (tx as any).receivable.update({
      where: { id },
      data: {
        status: 'RENEGOTIATED',
        notes: notes ? `${existing.notes ?? ''}\nRenegociado: ${notes}`.trim() : existing.notes,
      },
    });

    const newTotalAmount =
      newAmount !== undefined
        ? newAmount
        : Money.fromPrismaDecimal(existing.totalAmount).toNumber();
    const newTotalMoney = Money(newTotalAmount);
    const newDueDateObj = new Date(newDueDate);
    const installments = generateInstallments(newTotalMoney, 1, newDueDateObj);

    // (b) Create new Receivable linked via notes
    const newReceivable = await (tx as any).receivable.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: existing.farmId,
        producerId: existing.producerId,
        clientName: existing.clientName,
        category: existing.category,
        description: existing.description,
        totalAmount: newTotalMoney.toDecimal(),
        dueDate: newDueDateObj,
        documentNumber: existing.documentNumber,
        nfeKey: existing.nfeKey,
        funruralRate: existing.funruralRate,
        funruralAmount:
          existing.funruralRate != null
            ? newTotalMoney
                .multiply(Money.fromPrismaDecimal(existing.funruralRate).toNumber())
                .toDecimal()
            : null,
        installmentCount: 1,
        bankAccountId: existing.bankAccountId,
        notes: notes
          ? `Renegociação de #${id.slice(0, 8)}: ${notes}`
          : `Renegociação de #${id.slice(0, 8)}`,
      },
    });

    // (c) Create single installment for new receivable
    await (tx as any).receivableInstallment.createMany({
      data: installments.map((inst) => ({
        receivableId: newReceivable.id,
        number: inst.number,
        amount: inst.amount.toDecimal(),
        dueDate: inst.dueDate,
      })),
    });

    // (d) Copy cost center items from original
    if (existing.costCenterItems && existing.costCenterItems.length > 0) {
      await (tx as any).receivableCostCenterItem.createMany({
        data: existing.costCenterItems.map((item: any) => ({
          receivableId: newReceivable.id,
          costCenterId: item.costCenterId,
          farmId: item.farmId,
          allocMode: item.allocMode,
          percentage: item.percentage,
          fixedAmount: item.fixedAmount,
        })),
      });
    }

    return (tx as any).receivable.findUnique({
      where: { id: newReceivable.id },
      include: RECEIVABLE_INCLUDE,
    });
  });

  return toReceivableOutput(newRow);
}

// ─── getReceivablesAging ─────────────────────────────────────────────

export async function getReceivablesAging(
  ctx: RlsContext,
  farmId?: string,
): Promise<AgingResponse> {
  const where: any = {
    organizationId: ctx.organizationId,
    status: { in: ['PENDING', 'OVERDUE'] },
  };
  if (farmId) where.farmId = farmId;

  const rows = await withRlsContext(ctx, async (tx) => {
    return (tx as any).receivable.findMany({
      where,
      select: {
        id: true,
        totalAmount: true,
        dueDate: true,
        status: true,
      },
    });
  });

  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  const bucketDefs: {
    bucket: AgingBucket;
    label: string;
    minDays: number;
    maxDays: number | null;
  }[] = [
    { bucket: 'overdue', label: 'Vencidas', minDays: -Infinity as any, maxDays: -1 },
    { bucket: 'due_7d', label: 'Vencem em 7 dias', minDays: 0, maxDays: 7 },
    { bucket: 'due_15d', label: 'Vencem em 15 dias', minDays: 8, maxDays: 15 },
    { bucket: 'due_30d', label: 'Vencem em 30 dias', minDays: 16, maxDays: 30 },
    { bucket: 'due_60d', label: 'Vencem em 60 dias', minDays: 31, maxDays: 60 },
    { bucket: 'due_90d', label: 'Vencem em 90 dias', minDays: 61, maxDays: 90 },
    { bucket: 'due_over_90d', label: 'Mais de 90 dias', minDays: 91, maxDays: null },
  ];

  const bucketMap = new Map<AgingBucket, { count: number; total: typeof Money.prototype }>(
    bucketDefs.map((b) => [b.bucket, { count: 0, total: Money(0) }]),
  );

  let grandTotal = Money(0);
  let overdueCount = 0;

  for (const row of rows as any[]) {
    const dueDate = new Date(row.dueDate as Date);
    dueDate.setUTCHours(0, 0, 0, 0);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const amount = Money.fromPrismaDecimal(row.totalAmount);
    grandTotal = grandTotal.add(amount);

    let assignedBucket: AgingBucket | null = null;
    for (const def of bucketDefs) {
      const minOk = def.minDays === (-Infinity as any) ? diffDays <= -1 : diffDays >= def.minDays;
      const maxOk = def.maxDays === null ? true : diffDays <= def.maxDays;
      if (minOk && maxOk) {
        assignedBucket = def.bucket;
        break;
      }
    }

    if (assignedBucket) {
      const entry = bucketMap.get(assignedBucket)!;
      entry.count += 1;
      entry.total = entry.total.add(amount);
      if (assignedBucket === 'overdue') overdueCount += 1;
    }
  }

  const buckets: AgingBucketResult[] = bucketDefs.map((def) => {
    const entry = bucketMap.get(def.bucket)!;
    return {
      bucket: def.bucket,
      label: def.label,
      count: entry.count,
      total: entry.total.toNumber(),
    };
  });

  return {
    buckets,
    grandTotal: grandTotal.toNumber(),
    overdueCount,
  };
}

// ─── getReceivablesByBucket ──────────────────────────────────────────

export async function getReceivablesByBucket(
  ctx: RlsContext,
  bucket: string,
  farmId?: string,
): Promise<ReceivableOutput[]> {
  const where: any = {
    organizationId: ctx.organizationId,
    status: { in: ['PENDING', 'OVERDUE'] },
  };
  if (farmId) where.farmId = farmId;

  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  // Map bucket name to dueDate filter
  const bucketFilters: Record<string, any> = {
    overdue: { lt: now },
    due_7d: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) },
    due_15d: {
      gte: new Date(now.getTime() + 8 * 86400000),
      lte: new Date(now.getTime() + 15 * 86400000),
    },
    due_30d: {
      gte: new Date(now.getTime() + 16 * 86400000),
      lte: new Date(now.getTime() + 30 * 86400000),
    },
    due_60d: {
      gte: new Date(now.getTime() + 31 * 86400000),
      lte: new Date(now.getTime() + 60 * 86400000),
    },
    due_90d: {
      gte: new Date(now.getTime() + 61 * 86400000),
      lte: new Date(now.getTime() + 90 * 86400000),
    },
    due_over_90d: { gt: new Date(now.getTime() + 90 * 86400000) },
  };

  const dueDateFilter = bucketFilters[bucket];
  if (!dueDateFilter) {
    throw new ReceivableError(`Faixa de aging inválida: ${bucket}`, 400);
  }
  where.dueDate = dueDateFilter;

  const rows = await withRlsContext(ctx, async (tx) => {
    return (tx as any).receivable.findMany({
      where,
      include: RECEIVABLE_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
  });

  return (rows as any[]).map(toReceivableOutput);
}
