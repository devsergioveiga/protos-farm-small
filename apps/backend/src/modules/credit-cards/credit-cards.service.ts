import { Money } from '@protos-farm/shared';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { createPayable } from '../payables/payables.service';
import {
  CreditCardError,
  type CreateCreditCardInput,
  type UpdateCreditCardInput,
  type AddExpenseInput,
  type CreditCardOutput,
  type BillOutput,
  type ExpenseOutput,
  type OpenBillsCountOutput,
} from './credit-cards.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ─────────────────────────────────────────────────────────

function toExpenseOutput(row: any): ExpenseOutput {
  return {
    id: row.id as string,
    description: row.description as string,
    amount: Money.fromPrismaDecimal(row.amount).toNumber(),
    expenseDate: (row.expenseDate as Date).toISOString(),
    installmentNumber: row.installmentNumber as number,
    totalInstallments: row.totalInstallments as number,
    category: (row.category as string) ?? null,
    notes: (row.notes as string) ?? null,
  };
}

function toBillOutput(row: any): BillOutput {
  return {
    id: row.id as string,
    periodStart: (row.periodStart as Date).toISOString(),
    periodEnd: (row.periodEnd as Date).toISOString(),
    dueDate: (row.dueDate as Date).toISOString(),
    totalAmount: Money.fromPrismaDecimal(row.totalAmount).toNumber(),
    status: row.status as string,
    payableId: (row.payableId as string) ?? null,
    expenses: (row.expenses ?? []).map(toExpenseOutput),
    closedAt: row.closedAt ? (row.closedAt as Date).toISOString() : null,
  };
}

function toCreditCardOutput(row: any): CreditCardOutput {
  // Find current OPEN bill
  const currentBill =
    (row.bills ?? []).find((b: any) => b.status === 'OPEN') ?? row.currentBill ?? null;

  return {
    id: row.id as string,
    name: row.name as string,
    brand: row.brand as string,
    lastFourDigits: (row.lastFourDigits as string) ?? null,
    creditLimit: Money.fromPrismaDecimal(row.creditLimit).toNumber(),
    closingDay: row.closingDay as number,
    dueDay: row.dueDay as number,
    debitAccountId: row.debitAccountId as string,
    debitAccountName: row.debitAccount?.name ?? '',
    farmId: row.farmId as string,
    farmName: row.farm?.name ?? '',
    holder: row.holder as string,
    isActive: row.isActive as boolean,
    notes: (row.notes as string) ?? null,
    currentBill: currentBill ? toBillOutput(currentBill) : null,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

const BILL_INCLUDE = {
  expenses: {
    orderBy: { expenseDate: 'asc' as const },
  },
};

const CREDIT_CARD_INCLUDE = {
  debitAccount: { select: { id: true, name: true } },
  farm: { select: { id: true, name: true } },
  bills: {
    where: { status: 'OPEN' as const },
    include: BILL_INCLUDE,
    orderBy: { periodStart: 'desc' as const },
    take: 1,
  },
};

// ─── getBillPeriod ────────────────────────────────────────────────────

export function getBillPeriod(
  closingDay: number,
  dueDay: number,
  referenceDate: Date,
): { start: Date; end: Date; dueDate: Date } {
  // periodStart = closingDay of PREVIOUS month (UTC)
  // periodEnd = closingDay - 1 of CURRENT month (23:59:59.999 UTC)
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth(); // 0-indexed

  // Determine current billing period based on referenceDate vs closingDay
  // If referenceDate day >= closingDay → period is: closingDay this month → closingDay-1 next month
  // If referenceDate day < closingDay → period is: closingDay last month → closingDay-1 this month
  const refDay = referenceDate.getUTCDate();

  let periodStartMonth: number;
  let periodStartYear: number;
  let periodEndMonth: number;
  let periodEndYear: number;

  if (refDay >= closingDay) {
    // Period started this month
    periodStartMonth = month;
    periodStartYear = year;
    periodEndMonth = month + 1;
    periodEndYear = year;
    if (periodEndMonth > 11) {
      periodEndMonth = 0;
      periodEndYear = year + 1;
    }
  } else {
    // Period started last month
    periodStartMonth = month - 1;
    periodStartYear = year;
    if (periodStartMonth < 0) {
      periodStartMonth = 11;
      periodStartYear = year - 1;
    }
    periodEndMonth = month;
    periodEndYear = year;
  }

  const start = new Date(Date.UTC(periodStartYear, periodStartMonth, closingDay));

  // periodEnd = closingDay - 1 of periodEndMonth, or last day of periodStartMonth if closingDay === 1
  let endDay = closingDay - 1;
  let endMonth = periodEndMonth;
  let endYear = periodEndYear;

  if (endDay === 0) {
    // Use last day of the previous month
    const lastDayDate = new Date(Date.UTC(periodEndYear, periodEndMonth, 0));
    endDay = lastDayDate.getUTCDate();
    endMonth = periodEndMonth - 1;
    endYear = periodEndYear;
    if (endMonth < 0) {
      endMonth = 11;
      endYear = periodEndYear - 1;
    }
  }

  const end = new Date(Date.UTC(endYear, endMonth, endDay, 23, 59, 59, 999));

  // dueDate = dueDay of periodEndMonth
  const dueDate = new Date(Date.UTC(periodEndYear, periodEndMonth, dueDay));

  return { start, end, dueDate };
}

// ─── getOrCreateBill ──────────────────────────────────────────────────

async function getOrCreateBill(
  tx: any,
  organizationId: string,
  creditCardId: string,
  closingDay: number,
  dueDay: number,
  referenceDate: Date,
): Promise<any> {
  const period = getBillPeriod(closingDay, dueDay, referenceDate);

  // Find existing OPEN bill for that period
  const existing = await tx.creditCardBill.findFirst({
    where: {
      creditCardId,
      periodStart: period.start,
      status: 'OPEN',
    },
    include: BILL_INCLUDE,
  });

  if (existing) return existing;

  // Create new bill
  return tx.creditCardBill.create({
    data: {
      creditCardId,
      organizationId,
      periodStart: period.start,
      periodEnd: period.end,
      dueDate: period.dueDate,
      totalAmount: 0,
      status: 'OPEN',
    },
    include: BILL_INCLUDE,
  });
}

// ─── createCreditCard ─────────────────────────────────────────────────

export async function createCreditCard(
  ctx: RlsContext,
  input: CreateCreditCardInput,
): Promise<CreditCardOutput> {
  const {
    name,
    brand,
    lastFourDigits,
    creditLimit,
    closingDay,
    dueDay,
    debitAccountId,
    farmId,
    holder,
    notes,
  } = input;

  // Validate closingDay and dueDay
  if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 28) {
    throw new CreditCardError('O dia de fechamento deve ser entre 1 e 28', 400);
  }
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
    throw new CreditCardError('O dia de vencimento deve ser entre 1 e 28', 400);
  }

  // Validate lastFourDigits if provided
  if (lastFourDigits !== undefined && !/^\d{4}$/.test(lastFourDigits)) {
    throw new CreditCardError('Os últimos 4 dígitos devem ser exatamente 4 números', 400);
  }

  const card = await withRlsContext(ctx, async (tx) => {
    // Validate debitAccountId exists and is active
    const bankAccount = await tx.bankAccount.findFirst({
      where: { id: debitAccountId, organizationId: ctx.organizationId, isActive: true },
    });
    if (!bankAccount) {
      throw new CreditCardError('Conta bancária não encontrada ou inativa', 404);
    }

    // Validate farmId exists
    const farm = await tx.farm.findFirst({
      where: { id: farmId, organizationId: ctx.organizationId },
    });
    if (!farm) {
      throw new CreditCardError('Fazenda não encontrada', 404);
    }

    const created = await tx.creditCard.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        brand,
        lastFourDigits: lastFourDigits ?? null,
        creditLimit: Money(creditLimit).toDecimal(),
        closingDay,
        dueDay,
        debitAccountId,
        farmId,
        holder,
        notes: notes ?? null,
      },
      include: CREDIT_CARD_INCLUDE,
    });

    return created;
  });

  return toCreditCardOutput(card);
}

// ─── listCreditCards ──────────────────────────────────────────────────

export async function listCreditCards(ctx: RlsContext): Promise<CreditCardOutput[]> {
  const cards = await withRlsContext(ctx, async (tx) => {
    return tx.creditCard.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      include: CREDIT_CARD_INCLUDE,
      orderBy: { name: 'asc' },
    });
  });

  return (cards as any[]).map(toCreditCardOutput);
}

// ─── getCreditCard ────────────────────────────────────────────────────

export async function getCreditCard(
  ctx: RlsContext,
  cardId: string,
): Promise<CreditCardOutput & { bills: BillOutput[] }> {
  const card = await withRlsContext(ctx, async (tx) => {
    return tx.creditCard.findFirst({
      where: { id: cardId, organizationId: ctx.organizationId },
      include: {
        debitAccount: { select: { id: true, name: true } },
        farm: { select: { id: true, name: true } },
        bills: {
          include: BILL_INCLUDE,
          orderBy: { periodStart: 'desc' as const },
          take: 3,
        },
      },
    });
  });

  if (!card) {
    throw new CreditCardError('Cartão não encontrado', 404);
  }

  const base = toCreditCardOutput(card as any);
  return {
    ...base,
    bills: ((card as any).bills ?? []).map(toBillOutput),
  };
}

// ─── updateCreditCard ─────────────────────────────────────────────────

export async function updateCreditCard(
  ctx: RlsContext,
  cardId: string,
  input: UpdateCreditCardInput,
): Promise<CreditCardOutput> {
  const { closingDay, dueDay, lastFourDigits, creditLimit, debitAccountId, farmId, ...rest } =
    input;

  if (
    closingDay !== undefined &&
    (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 28)
  ) {
    throw new CreditCardError('O dia de fechamento deve ser entre 1 e 28', 400);
  }
  if (dueDay !== undefined && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28)) {
    throw new CreditCardError('O dia de vencimento deve ser entre 1 e 28', 400);
  }
  if (lastFourDigits !== undefined && !/^\d{4}$/.test(lastFourDigits)) {
    throw new CreditCardError('Os últimos 4 dígitos devem ser exatamente 4 números', 400);
  }

  const card = await withRlsContext(ctx, async (tx) => {
    const existing = await tx.creditCard.findFirst({
      where: { id: cardId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new CreditCardError('Cartão não encontrado', 404);
    }

    if (debitAccountId) {
      const bankAccount = await tx.bankAccount.findFirst({
        where: { id: debitAccountId, organizationId: ctx.organizationId, isActive: true },
      });
      if (!bankAccount) {
        throw new CreditCardError('Conta bancária não encontrada ou inativa', 404);
      }
    }

    if (farmId) {
      const farm = await tx.farm.findFirst({
        where: { id: farmId, organizationId: ctx.organizationId },
      });
      if (!farm) {
        throw new CreditCardError('Fazenda não encontrada', 404);
      }
    }

    const updateData: any = { ...rest };
    if (closingDay !== undefined) updateData.closingDay = closingDay;
    if (dueDay !== undefined) updateData.dueDay = dueDay;
    if (lastFourDigits !== undefined) updateData.lastFourDigits = lastFourDigits;
    if (creditLimit !== undefined) updateData.creditLimit = Money(creditLimit).toDecimal();
    if (debitAccountId !== undefined) updateData.debitAccountId = debitAccountId;
    if (farmId !== undefined) updateData.farmId = farmId;

    return tx.creditCard.update({
      where: { id: cardId },
      data: updateData,
      include: CREDIT_CARD_INCLUDE,
    });
  });

  return toCreditCardOutput(card as any);
}

// ─── deleteCreditCard ─────────────────────────────────────────────────

export async function deleteCreditCard(ctx: RlsContext, cardId: string): Promise<void> {
  await withRlsContext(ctx, async (tx) => {
    const existing = await tx.creditCard.findFirst({
      where: { id: cardId, organizationId: ctx.organizationId },
      include: {
        bills: {
          where: { status: 'OPEN' },
          include: { expenses: true },
        },
      },
    });

    if (!existing) {
      throw new CreditCardError('Cartão não encontrado', 404);
    }

    // Check for OPEN bills with expenses
    const openBillsWithExpenses = (existing as any).bills.filter((b: any) => b.expenses.length > 0);
    if (openBillsWithExpenses.length > 0) {
      throw new CreditCardError(
        'Não é possível excluir cartão com fatura aberta contendo despesas',
        422,
      );
    }

    await tx.creditCard.update({
      where: { id: cardId },
      data: { isActive: false },
    });
  });
}

// ─── addExpense ───────────────────────────────────────────────────────

export async function addExpense(
  ctx: RlsContext,
  cardId: string,
  input: AddExpenseInput,
): Promise<ExpenseOutput[]> {
  const { description, amount, totalInstallments, expenseDate, category, notes } = input;

  if (totalInstallments < 1 || totalInstallments > 24) {
    throw new CreditCardError('O número de parcelas deve ser entre 1 e 24', 400);
  }
  if (amount <= 0) {
    throw new CreditCardError('O valor deve ser maior que zero', 400);
  }

  const expenses = await withRlsContext(ctx, async (tx) => {
    const card = await tx.creditCard.findFirst({
      where: { id: cardId, organizationId: ctx.organizationId, isActive: true },
    });

    if (!card) {
      throw new CreditCardError('Cartão não encontrado ou inativo', 404);
    }

    const totalMoney = Money(amount);
    // Use floor division to avoid rounding up; remainder goes to first installment
    const baseAmountRaw = Math.floor((amount * 100) / totalInstallments) / 100;
    const baseAmount = Money(baseAmountRaw);
    const residual = totalMoney.subtract(baseAmount.multiply(totalInstallments));

    const baseDateUtc = new Date(expenseDate);

    const createdExpenses: any[] = [];

    for (let i = 0; i < totalInstallments; i++) {
      // Calculate referenceDate = expenseDate + i months (UTC month arithmetic)
      const refDate = new Date(
        Date.UTC(
          baseDateUtc.getUTCFullYear(),
          baseDateUtc.getUTCMonth() + i,
          baseDateUtc.getUTCDate(),
        ),
      );

      const bill = await getOrCreateBill(
        tx,
        ctx.organizationId,
        cardId,
        (card as any).closingDay,
        (card as any).dueDay,
        refDate,
      );

      // First installment gets the residual (rounding adjustment)
      const installmentAmount = i === 0 ? baseAmount.add(residual) : baseAmount;

      const expense = await tx.creditCardExpense.create({
        data: {
          organizationId: ctx.organizationId,
          creditCardId: cardId,
          billId: bill.id,
          description,
          amount: installmentAmount.toDecimal(),
          expenseDate: baseDateUtc,
          installmentNumber: i + 1,
          totalInstallments,
          category: category ?? null,
          notes: notes ?? null,
        },
      });

      // Update bill totalAmount
      await tx.creditCardBill.update({
        where: { id: bill.id },
        data: {
          totalAmount: {
            increment: installmentAmount.toDecimal(),
          },
        },
      });

      createdExpenses.push(expense);
    }

    return createdExpenses;
  });

  return expenses.map(toExpenseOutput);
}

// ─── listBills ────────────────────────────────────────────────────────

export async function listBills(ctx: RlsContext, cardId: string, limit = 3): Promise<BillOutput[]> {
  const bills = await withRlsContext(ctx, async (tx) => {
    // Verify card belongs to org
    const card = await tx.creditCard.findFirst({
      where: { id: cardId, organizationId: ctx.organizationId },
    });
    if (!card) {
      throw new CreditCardError('Cartão não encontrado', 404);
    }

    return tx.creditCardBill.findMany({
      where: { creditCardId: cardId, organizationId: ctx.organizationId },
      include: BILL_INCLUDE,
      orderBy: { periodStart: 'desc' },
      take: limit,
    });
  });

  return (bills as any[]).map(toBillOutput);
}

// ─── closeBill ────────────────────────────────────────────────────────

export async function closeBill(ctx: RlsContext, billId: string) {
  return withRlsContext(ctx, async (tx) => {
    const bill = await tx.creditCardBill.findFirst({
      where: { id: billId, organizationId: ctx.organizationId },
      include: {
        expenses: true,
        creditCard: {
          include: {
            farm: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!bill) {
      throw new CreditCardError('Fatura não encontrada', 404);
    }

    if ((bill as any).status === 'CLOSED') {
      throw new CreditCardError('Esta fatura já foi fechada', 422);
    }

    if ((bill as any).expenses.length === 0) {
      throw new CreditCardError('Adicione ao menos um gasto antes de fechar a fatura.', 422);
    }

    // Calculate total from expenses
    const total = (bill as any).expenses.reduce(
      (acc: ReturnType<typeof Money>, exp: any) => acc.add(Money.fromPrismaDecimal(exp.amount)),
      Money(0),
    );

    const card = (bill as any).creditCard;
    const dueDate = (bill as any).dueDate as Date;
    const dueDateStr = dueDate.toUTCString().slice(0, 16); // format as "DD Mon YYYY"

    // Call createPayable (runs within our withRlsContext transaction)
    // Note: createPayable itself calls withRlsContext internally, so we call it at the ctx level
    // We need to close the bill after payable creation
    // We'll update bill status after calling createPayable
    const payable = await createPayable(ctx, {
      farmId: card.farmId,
      supplierName: card.name,
      category: 'CARTAO_CREDITO',
      description: `Fatura ${card.name} — venc. ${dueDate.toISOString().slice(0, 10)}`,
      totalAmount: total.toNumber(),
      dueDate: dueDate.toISOString(),
      bankAccountId: card.debitAccountId,
      installmentCount: 1,
      costCenterItems: [],
    });

    // Update bill: status=CLOSED, payableId, closedAt
    await tx.creditCardBill.update({
      where: { id: billId },
      data: {
        status: 'CLOSED',
        payableId: payable.id,
        closedAt: new Date(),
      },
    });

    void dueDateStr; // suppress unused warning

    return payable;
  });
}

// ─── getOpenBillsCount ────────────────────────────────────────────────

export async function getOpenBillsCount(ctx: RlsContext): Promise<OpenBillsCountOutput> {
  const count = await withRlsContext(ctx, async (tx) => {
    return tx.creditCardBill.count({
      where: { organizationId: ctx.organizationId, status: 'OPEN' },
    });
  });

  return { count: count as number };
}
