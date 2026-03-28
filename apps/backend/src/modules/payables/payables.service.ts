import { Money } from '@protos-farm/shared';
import { generateInstallments, validateCostCenterItems } from '@protos-farm/shared';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { process as autoPost } from '../auto-posting/auto-posting.service';
import {
  PayableError,
  PAYABLE_CATEGORY_LABELS,
  type CreatePayableInput,
  type UpdatePayableInput,
  type SettlePaymentInput,
  type BatchSettleInput,
  type ListPayablesQuery,
  type PayableOutput,
  type PayableInstallmentOutput,
  type PayableCostCenterItemOutput,
  type PaginatedPayablesOutput,
} from './payables.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ─────────────────────────────────────────────────────────

function toInstallmentOutput(row: any): PayableInstallmentOutput {
  return {
    id: row.id as string,
    number: row.number as number,
    amount: Money.fromPrismaDecimal(row.amount).toNumber(),
    dueDate: (row.dueDate as Date).toISOString(),
    status: row.status as string,
    paidAt: row.paidAt ? (row.paidAt as Date).toISOString() : null,
    amountPaid: row.amountPaid != null ? Money.fromPrismaDecimal(row.amountPaid).toNumber() : null,
  };
}

function toCostCenterItemOutput(row: any): PayableCostCenterItemOutput {
  return {
    id: row.id as string,
    costCenterId: row.costCenterId as string,
    farmId: row.farmId as string,
    allocMode: row.allocMode as string,
    percentage: row.percentage != null ? Money.fromPrismaDecimal(row.percentage).toNumber() : null,
    fixedAmount:
      row.fixedAmount != null ? Money.fromPrismaDecimal(row.fixedAmount).toNumber() : null,
  };
}

function toPayableOutput(row: any): PayableOutput {
  const category = row.category as string;
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    farmId: row.farmId as string,
    producerId: (row.producerId as string) ?? null,
    supplierName: row.supplierName as string,
    category,
    categoryLabel:
      PAYABLE_CATEGORY_LABELS[category as keyof typeof PAYABLE_CATEGORY_LABELS] ?? category,
    description: row.description as string,
    totalAmount: Money.fromPrismaDecimal(row.totalAmount).toNumber(),
    dueDate: (row.dueDate as Date).toISOString(),
    status: row.status as string,
    documentNumber: (row.documentNumber as string) ?? null,
    installmentCount: row.installmentCount as number,
    paidAt: row.paidAt ? (row.paidAt as Date).toISOString() : null,
    amountPaid: row.amountPaid != null ? Money.fromPrismaDecimal(row.amountPaid).toNumber() : null,
    bankAccountId: (row.bankAccountId as string) ?? null,
    interestAmount:
      row.interestAmount != null ? Money.fromPrismaDecimal(row.interestAmount).toNumber() : null,
    fineAmount: row.fineAmount != null ? Money.fromPrismaDecimal(row.fineAmount).toNumber() : null,
    discountAmount:
      row.discountAmount != null ? Money.fromPrismaDecimal(row.discountAmount).toNumber() : null,
    recurrenceFrequency: (row.recurrenceFrequency as string) ?? null,
    recurrenceEndDate: row.recurrenceEndDate ? (row.recurrenceEndDate as Date).toISOString() : null,
    recurrenceParentId: (row.recurrenceParentId as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
    installments: (row.installments ?? []).map(toInstallmentOutput),
    costCenterItems: (row.costCenterItems ?? []).map(toCostCenterItemOutput),
  };
}

const PAYABLE_INCLUDE = {
  installments: {
    orderBy: { number: 'asc' as const },
  },
  costCenterItems: true,
};

// ─── createPayable ────────────────────────────────────────────────────

export async function createPayable(
  ctx: RlsContext,
  input: CreatePayableInput,
): Promise<PayableOutput> {
  const {
    farmId,
    producerId,
    supplierName,
    category,
    description,
    totalAmount,
    dueDate,
    documentNumber,
    installmentCount = 1,
    costCenterItems,
    recurrenceFrequency,
    recurrenceEndDate,
    bankAccountId,
    notes,
  } = input;

  // Validate cost center items
  const totalMoney = Money(totalAmount);
  validateCostCenterItems(totalMoney, costCenterItems);

  // Generate installments
  const firstDueDate = new Date(dueDate);
  const installments = generateInstallments(totalMoney, installmentCount, firstDueDate);

  const payable = await withRlsContext(ctx, async (tx) => {
    // Create the Payable
    const created = await (tx as any).payable.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        producerId: producerId ?? null,
        supplierName,
        category,
        description,
        totalAmount: totalMoney.toDecimal(),
        dueDate: firstDueDate,
        documentNumber: documentNumber ?? null,
        installmentCount,
        recurrenceFrequency: recurrenceFrequency ?? null,
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        bankAccountId: bankAccountId ?? null,
        notes: notes ?? null,
      },
    });

    // Create installments
    await (tx as any).payableInstallment.createMany({
      data: installments.map((inst) => ({
        payableId: created.id,
        number: inst.number,
        amount: inst.amount.toDecimal(),
        dueDate: inst.dueDate,
      })),
    });

    // Create cost center items
    await (tx as any).payableCostCenterItem.createMany({
      data: costCenterItems.map((item) => ({
        payableId: created.id,
        costCenterId: item.costCenterId,
        farmId: item.farmId,
        allocMode: item.allocMode,
        percentage: item.percentage != null ? item.percentage : null,
        fixedAmount: item.fixedAmount != null ? Money(item.fixedAmount).toDecimal() : null,
      })),
    });

    return (tx as any).payable.findUnique({
      where: { id: created.id },
      include: PAYABLE_INCLUDE,
    });
  });

  return toPayableOutput(payable);
}

// ─── listPayables ─────────────────────────────────────────────────────

export async function listPayables(
  ctx: RlsContext,
  query: ListPayablesQuery = {},
): Promise<PaginatedPayablesOutput> {
  const { farmId, status, category, startDate, endDate, search, page = 1, limit = 20 } = query;

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
      { supplierName: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { documentNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [rows, total] = await withRlsContext(ctx, async (tx) => {
    return Promise.all([
      (tx as any).payable.findMany({
        where,
        include: PAYABLE_INCLUDE,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      (tx as any).payable.count({ where }),
    ]);
  });

  return {
    data: rows.map(toPayableOutput),
    total,
    page,
    limit,
  };
}

// ─── getPayable ───────────────────────────────────────────────────────

export async function getPayable(ctx: RlsContext, id: string): Promise<PayableOutput> {
  const payable = await withRlsContext(ctx, async (tx) => {
    return (tx as any).payable.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: PAYABLE_INCLUDE,
    });
  });

  if (!payable) {
    throw new PayableError('Conta a pagar não encontrada', 404);
  }

  return toPayableOutput(payable);
}

// ─── updatePayable ────────────────────────────────────────────────────

export async function updatePayable(
  ctx: RlsContext,
  id: string,
  input: UpdatePayableInput,
): Promise<PayableOutput> {
  const payable = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).payable.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new PayableError('Conta a pagar não encontrada', 404);
    }

    if (existing.status !== 'PENDING') {
      throw new PayableError('Apenas contas a pagar com status PENDING podem ser editadas', 422);
    }

    const { totalAmount, dueDate, installmentCount, costCenterItems, recurrenceEndDate, ...rest } =
      input;

    const newTotal =
      totalAmount !== undefined
        ? Money(totalAmount)
        : Money.fromPrismaDecimal(existing.totalAmount);
    const newFirstDueDate = dueDate ? new Date(dueDate) : (existing.dueDate as Date);
    const newInstallmentCount =
      installmentCount !== undefined ? installmentCount : (existing.installmentCount as number);

    // Revalidate and regenerate if relevant fields changed
    const needsInstallmentRegen =
      totalAmount !== undefined || dueDate !== undefined || installmentCount !== undefined;

    if (costCenterItems !== undefined) {
      validateCostCenterItems(newTotal, costCenterItems);
    }

    const updateData: any = { ...rest };
    if (totalAmount !== undefined) updateData.totalAmount = newTotal.toDecimal();
    if (dueDate !== undefined) updateData.dueDate = newFirstDueDate;
    if (installmentCount !== undefined) updateData.installmentCount = newInstallmentCount;
    if (recurrenceEndDate !== undefined) {
      updateData.recurrenceEndDate = recurrenceEndDate ? new Date(recurrenceEndDate) : null;
    }

    await (tx as any).payable.update({ where: { id }, data: updateData });

    // Regenerate installments if needed
    if (needsInstallmentRegen) {
      await (tx as any).payableInstallment.deleteMany({ where: { payableId: id } });
      const newInstallments = generateInstallments(newTotal, newInstallmentCount, newFirstDueDate);
      await (tx as any).payableInstallment.createMany({
        data: newInstallments.map((inst) => ({
          payableId: id,
          number: inst.number,
          amount: inst.amount.toDecimal(),
          dueDate: inst.dueDate,
        })),
      });
    }

    // Replace cost center items if provided
    if (costCenterItems !== undefined) {
      await (tx as any).payableCostCenterItem.deleteMany({ where: { payableId: id } });
      await (tx as any).payableCostCenterItem.createMany({
        data: costCenterItems.map((item) => ({
          payableId: id,
          costCenterId: item.costCenterId,
          farmId: item.farmId,
          allocMode: item.allocMode,
          percentage: item.percentage != null ? item.percentage : null,
          fixedAmount: item.fixedAmount != null ? Money(item.fixedAmount).toDecimal() : null,
        })),
      });
    }

    return (tx as any).payable.findUnique({
      where: { id },
      include: PAYABLE_INCLUDE,
    });
  });

  return toPayableOutput(payable);
}

// ─── deletePayable ────────────────────────────────────────────────────

export async function deletePayable(ctx: RlsContext, id: string): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).payable.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new PayableError('Conta a pagar não encontrada', 404);
    }

    if (existing.status !== 'PENDING') {
      throw new PayableError('Apenas contas a pagar com status PENDING podem ser canceladas', 422);
    }

    await (tx as any).payable.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  });
}

// ─── settlePayment ────────────────────────────────────────────────────

export async function settlePayment(
  ctx: RlsContext,
  payableId: string,
  input: SettlePaymentInput,
): Promise<PayableOutput> {
  const {
    paidAt,
    amount,
    bankAccountId,
    interestAmount = 0,
    fineAmount = 0,
    discountAmount = 0,
  } = input;

  const payable = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).payable.findFirst({
      where: { id: payableId, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new PayableError('Conta a pagar não encontrada', 404);
    }

    if (existing.status === 'PAID') {
      throw new PayableError('Esta conta a pagar já foi paga', 422);
    }

    if (existing.status === 'CANCELLED') {
      throw new PayableError('Não é possível dar baixa em conta cancelada', 422);
    }

    // Verify bank account belongs to org
    const bankAccount = await (tx as any).bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: ctx.organizationId, isActive: true },
    });

    if (!bankAccount) {
      throw new PayableError('Conta bancária não encontrada ou inativa', 404);
    }

    const amountMoney = Money(amount);
    const interestMoney = Money(interestAmount);
    const fineMoney = Money(fineAmount);
    const discountMoney = Money(discountAmount);

    // effectiveAmount = amount + interest + fine - discount
    const effectiveAmount = amountMoney.add(interestMoney).add(fineMoney).subtract(discountMoney);

    // (a) Update payable status to PAID
    await (tx as any).payable.update({
      where: { id: payableId },
      data: {
        status: 'PAID',
        paidAt: new Date(paidAt),
        amountPaid: amountMoney.toDecimal(),
        bankAccountId,
        interestAmount: interestMoney.toDecimal(),
        fineAmount: fineMoney.toDecimal(),
        discountAmount: discountMoney.toDecimal(),
      },
    });

    // Update first pending installment status as well
    const pendingInstallment = await (tx as any).payableInstallment.findFirst({
      where: { payableId, status: 'PENDING' },
      orderBy: { number: 'asc' },
    });
    if (pendingInstallment) {
      await (tx as any).payableInstallment.update({
        where: { id: pendingInstallment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(paidAt),
          amountPaid: amountMoney.toDecimal(),
        },
      });
    }

    // (b) Decrement BankAccountBalance
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId },
      data: {
        currentBalance: {
          decrement: effectiveAmount.toDecimal(),
        },
      },
    });

    // (c) Create FinancialTransaction (DEBIT)
    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        type: 'DEBIT',
        amount: effectiveAmount.toDecimal(),
        description: `Pagamento CP: ${existing.supplierName} - ${existing.description}`,
        referenceType: 'PAYABLE',
        referenceId: payableId,
        transactionDate: new Date(paidAt),
      },
    });

    return (tx as any).payable.findUnique({
      where: { id: payableId },
      include: PAYABLE_INCLUDE,
    });
  });

  // Auto-posting GL entry after settlement (non-blocking — per D-15)
  try {
    await autoPost('PAYABLE_SETTLEMENT', payableId, ctx.organizationId);
  } catch (err) {
    console.error('[payables] Auto-posting failed:', err);
  }

  return toPayableOutput(payable);
}

// ─── batchSettlePayments ──────────────────────────────────────────────

export async function batchSettlePayments(
  ctx: RlsContext,
  input: BatchSettleInput,
): Promise<PayableOutput[]> {
  const { bankAccountId, paidAt, items } = input;

  const results = await withRlsContext(ctx, async (tx) => {
    // Verify bank account
    const bankAccount = await (tx as any).bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: ctx.organizationId, isActive: true },
    });

    if (!bankAccount) {
      throw new PayableError('Conta bancária não encontrada ou inativa', 404);
    }

    let totalEffective = Money(0);
    const settledIds: string[] = [];

    for (const item of items) {
      const existing = await (tx as any).payable.findFirst({
        where: { id: item.payableId, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new PayableError(`Conta a pagar não encontrada: ${item.payableId}`, 404);
      }

      if (existing.status === 'PAID') {
        throw new PayableError(
          `Conta a pagar ${item.payableId} já foi paga. Bordero cancelado.`,
          422,
        );
      }

      if (existing.status === 'CANCELLED') {
        throw new PayableError(
          `Conta a pagar ${item.payableId} está cancelada. Bordero cancelado.`,
          422,
        );
      }

      const amountMoney = Money(item.amount);
      const interestMoney = Money(item.interestAmount ?? 0);
      const fineMoney = Money(item.fineAmount ?? 0);
      const discountMoney = Money(item.discountAmount ?? 0);
      const effectiveAmount = amountMoney.add(interestMoney).add(fineMoney).subtract(discountMoney);

      totalEffective = totalEffective.add(effectiveAmount);

      await (tx as any).payable.update({
        where: { id: item.payableId },
        data: {
          status: 'PAID',
          paidAt: new Date(paidAt),
          amountPaid: amountMoney.toDecimal(),
          bankAccountId,
          interestAmount: interestMoney.toDecimal(),
          fineAmount: fineMoney.toDecimal(),
          discountAmount: discountMoney.toDecimal(),
        },
      });

      // Update first pending installment
      const pendingInstallment = await (tx as any).payableInstallment.findFirst({
        where: { payableId: item.payableId, status: 'PENDING' },
        orderBy: { number: 'asc' },
      });
      if (pendingInstallment) {
        await (tx as any).payableInstallment.update({
          where: { id: pendingInstallment.id },
          data: {
            status: 'PAID',
            paidAt: new Date(paidAt),
            amountPaid: amountMoney.toDecimal(),
          },
        });
      }

      settledIds.push(item.payableId);
    }

    // Single balance decrement for the batch total
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId },
      data: {
        currentBalance: {
          decrement: totalEffective.toDecimal(),
        },
      },
    });

    // Single FinancialTransaction for the batch (bordero)
    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        type: 'DEBIT',
        amount: totalEffective.toDecimal(),
        description: `Borderô — ${items.length} título(s) liquidado(s)`,
        referenceType: 'PAYABLE_BATCH',
        referenceId: null,
        transactionDate: new Date(paidAt),
      },
    });

    return (tx as any).payable.findMany({
      where: { id: { in: settledIds } },
      include: PAYABLE_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
  });

  return results.map(toPayableOutput);
}

// ─── reversePayment ───────────────────────────────────────────────────

export async function reversePayment(ctx: RlsContext, payableId: string): Promise<PayableOutput> {
  const payable = await withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).payable.findFirst({
      where: { id: payableId, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new PayableError('Conta a pagar não encontrada', 404);
    }

    if (existing.status !== 'PAID') {
      throw new PayableError('Apenas pagamentos realizados podem ser estornados', 422);
    }

    const bankAccountId = existing.bankAccountId as string;
    if (!bankAccountId) {
      throw new PayableError('Conta bancária não associada ao pagamento', 422);
    }

    const interestMoney = Money.fromPrismaDecimal(existing.interestAmount ?? 0);
    const fineMoney = Money.fromPrismaDecimal(existing.fineAmount ?? 0);
    const discountMoney = Money.fromPrismaDecimal(existing.discountAmount ?? 0);
    const amountPaid = Money.fromPrismaDecimal(existing.amountPaid ?? 0);
    const effectiveAmount = amountPaid.add(interestMoney).add(fineMoney).subtract(discountMoney);

    // (a) Reset payable to PENDING and clear settlement fields
    await (tx as any).payable.update({
      where: { id: payableId },
      data: {
        status: 'PENDING',
        paidAt: null,
        amountPaid: null,
        interestAmount: null,
        fineAmount: null,
        discountAmount: null,
      },
    });

    // Reset any paid installments back to PENDING
    await (tx as any).payableInstallment.updateMany({
      where: { payableId, status: 'PAID' },
      data: {
        status: 'PENDING',
        paidAt: null,
        amountPaid: null,
      },
    });

    // (b) Increment BankAccountBalance (reversal)
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId },
      data: {
        currentBalance: {
          increment: effectiveAmount.toDecimal(),
        },
      },
    });

    // (c) Create CREDIT FinancialTransaction for estorno
    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId,
        type: 'CREDIT',
        amount: effectiveAmount.toDecimal(),
        description: `Estorno CP #${payableId.slice(0, 8)}: ${existing.supplierName}`,
        referenceType: 'PAYABLE_REVERSAL',
        referenceId: payableId,
        transactionDate: new Date(),
      },
    });

    return (tx as any).payable.findUnique({
      where: { id: payableId },
      include: PAYABLE_INCLUDE,
    });
  });

  // Auto-posting GL entry after reversal (non-blocking — per D-15)
  try {
    await autoPost('PAYABLE_REVERSAL', payableId, ctx.organizationId);
  } catch (err) {
    console.error('[payables] Auto-posting reversal failed:', err);
  }

  return toPayableOutput(payable);
}

// ─── generateRecurrence ───────────────────────────────────────────────

export async function generateRecurrence(ctx: RlsContext): Promise<PayableOutput[]> {
  const now = new Date();

  const generated = await withRlsContext(ctx, async (tx) => {
    // Find all recurrence templates (no parent, has recurrenceFrequency)
    const templates = await (tx as any).payable.findMany({
      where: {
        organizationId: ctx.organizationId,
        recurrenceFrequency: { not: null },
        recurrenceParentId: null,
        status: { not: 'CANCELLED' },
        OR: [{ recurrenceEndDate: null }, { recurrenceEndDate: { gte: now } }],
      },
      include: {
        recurrenceChildren: {
          orderBy: { dueDate: 'desc' },
          take: 1,
        },
        costCenterItems: true,
      },
    });

    const createdPayables: any[] = [];

    for (const template of templates) {
      const freq = template.recurrenceFrequency as string;
      const frequencyMonths =
        freq === 'MONTHLY' ? 1 : freq === 'BIWEEKLY' ? 0.5 : freq === 'WEEKLY' ? 0.25 : 1;

      // Determine the last child due date (or template due date if no children)
      const lastChild = template.recurrenceChildren[0];
      const lastDueDate: Date = lastChild
        ? (lastChild.dueDate as Date)
        : (template.dueDate as Date);

      // Calculate next due date
      let nextDueDate: Date;
      if (freq === 'MONTHLY') {
        nextDueDate = new Date(lastDueDate);
        nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + 1);
      } else if (freq === 'BIWEEKLY') {
        nextDueDate = new Date(lastDueDate);
        nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 14);
      } else {
        // WEEKLY
        nextDueDate = new Date(lastDueDate);
        nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 7);
      }

      // Check if we haven't yet generated the next one
      // (nextDueDate should be in the past or present — i.e., it's due)
      if (nextDueDate > now) {
        continue; // Not yet due for generation
      }

      // Check recurrenceEndDate constraint
      if (template.recurrenceEndDate && nextDueDate > (template.recurrenceEndDate as Date)) {
        continue;
      }

      const totalMoney = Money.fromPrismaDecimal(template.totalAmount);
      const installmentCount = template.installmentCount as number;

      // Create child payable
      const child = await (tx as any).payable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: template.farmId,
          producerId: template.producerId ?? null,
          supplierName: template.supplierName,
          category: template.category,
          description: template.description,
          totalAmount: totalMoney.toDecimal(),
          dueDate: nextDueDate,
          documentNumber: template.documentNumber ?? null,
          installmentCount,
          recurrenceParentId: template.id,
          bankAccountId: template.bankAccountId ?? null,
          notes: template.notes ?? null,
        },
      });

      // Generate installments
      const installments = generateInstallments(totalMoney, installmentCount, nextDueDate);
      await (tx as any).payableInstallment.createMany({
        data: installments.map((inst) => ({
          payableId: child.id,
          number: inst.number,
          amount: inst.amount.toDecimal(),
          dueDate: inst.dueDate,
        })),
      });

      // Copy cost center items
      if (template.costCenterItems.length > 0) {
        await (tx as any).payableCostCenterItem.createMany({
          data: (template.costCenterItems as any[]).map((item: any) => ({
            payableId: child.id,
            costCenterId: item.costCenterId,
            farmId: item.farmId,
            allocMode: item.allocMode,
            percentage: item.percentage ?? null,
            fixedAmount: item.fixedAmount ?? null,
          })),
        });
      }

      const withRelations = await (tx as any).payable.findUnique({
        where: { id: child.id },
        include: PAYABLE_INCLUDE,
      });
      createdPayables.push(withRelations);

      void frequencyMonths; // suppress unused warning
    }

    return createdPayables;
  });

  return generated.map(toPayableOutput);
}
