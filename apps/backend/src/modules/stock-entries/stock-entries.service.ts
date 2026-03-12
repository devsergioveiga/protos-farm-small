import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import {
  StockEntryError,
  EXPENSE_TYPES,
  APPORTIONMENT_METHODS,
  EXPENSE_TYPE_LABELS,
  type CreateStockEntryInput,
  type AddExpenseInput,
  type ListStockEntriesQuery,
  type StockEntryOutput,
  type StockEntryItemOutput,
  type StockEntryExpenseOutput,
  type StockBalanceOutput,
  type ListStockEntriesResult,
  type ExpenseTypeValue,
} from './stock-entries.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function validateItems(items: CreateStockEntryInput['items']): void {
  if (!items || items.length === 0) {
    throw new StockEntryError('Pelo menos um item é obrigatório', 400);
  }
  for (const item of items) {
    if (!item.productId?.trim()) {
      throw new StockEntryError('Produto é obrigatório em cada item', 400);
    }
    if (!item.quantity || item.quantity <= 0) {
      throw new StockEntryError('Quantidade deve ser maior que zero', 400);
    }
    if (item.unitCost == null || item.unitCost < 0) {
      throw new StockEntryError('Custo unitário não pode ser negativo', 400);
    }
  }
}

function validateExpense(expense: AddExpenseInput): void {
  if (!expense.expenseType || !(EXPENSE_TYPES as readonly string[]).includes(expense.expenseType)) {
    throw new StockEntryError(`Tipo de despesa inválido. Use: ${EXPENSE_TYPES.join(', ')}`, 400);
  }
  if (expense.amount == null || expense.amount <= 0) {
    throw new StockEntryError('Valor da despesa deve ser maior que zero', 400);
  }
  if (
    expense.apportionmentMethod &&
    !(APPORTIONMENT_METHODS as readonly string[]).includes(expense.apportionmentMethod)
  ) {
    throw new StockEntryError(
      `Método de rateio inválido. Use: ${APPORTIONMENT_METHODS.join(', ')}`,
      400,
    );
  }
}

// ─── Apportionment Logic (CA3, CA4) ─────────────────────────────────

function apportionExpenses(
  items: Array<{ totalCost: number; quantity: number; weightKg: number | null }>,
  expenses: Array<{ amount: number; apportionmentMethod: string }>,
): number[] {
  const result = new Array(items.length).fill(0);

  for (const expense of expenses) {
    const method = expense.apportionmentMethod || 'BY_VALUE';

    if (method === 'BY_VALUE') {
      const totalValue = items.reduce((s, i) => s + i.totalCost, 0);
      if (totalValue > 0) {
        for (let i = 0; i < items.length; i++) {
          result[i] += (items[i].totalCost / totalValue) * expense.amount;
        }
      }
    } else if (method === 'BY_QUANTITY') {
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);
      if (totalQty > 0) {
        for (let i = 0; i < items.length; i++) {
          result[i] += (items[i].quantity / totalQty) * expense.amount;
        }
      }
    } else if (method === 'BY_WEIGHT') {
      const totalWeight = items.reduce((s, i) => s + (i.weightKg || 0), 0);
      if (totalWeight > 0) {
        for (let i = 0; i < items.length; i++) {
          result[i] += ((items[i].weightKg || 0) / totalWeight) * expense.amount;
        }
      }
    } else if (method === 'FIXED') {
      // Fixed amount per item, distributed equally
      const perItem = expense.amount / items.length;
      for (let i = 0; i < items.length; i++) {
        result[i] += perItem;
      }
    }
  }

  return result;
}

// ─── Cost Alert (CA9) ───────────────────────────────────────────────

interface CostAlert {
  productId: string;
  productName: string;
  currentAvgCost: number;
  newUnitCost: number;
  divergencePct: number;
}

async function checkCostDivergence(
  tx: TxClient,
  organizationId: string,
  items: Array<{ productId: string; unitCost: number }>,
): Promise<CostAlert[]> {
  const alerts: CostAlert[] = [];

  for (const item of items) {
    const balance = await (tx as any).stockBalance.findUnique({
      where: { organizationId_productId: { organizationId, productId: item.productId } },
    });

    if (balance && toNumber(balance.averageCost) > 0) {
      const avgCost = toNumber(balance.averageCost);
      const divergence = Math.abs((item.unitCost - avgCost) / avgCost) * 100;

      if (divergence > 20) {
        const product = await (tx as any).product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });
        alerts.push({
          productId: item.productId,
          productName: product?.name || item.productId,
          currentAvgCost: avgCost,
          newUnitCost: item.unitCost,
          divergencePct: Math.round(divergence * 100) / 100,
        });
      }
    }
  }

  return alerts;
}

// ─── Update Stock Balance (CA5) ─────────────────────────────────────

async function updateStockBalances(
  tx: TxClient,
  organizationId: string,
  items: Array<{
    productId: string;
    quantity: number;
    finalTotalCost: number;
  }>,
  entryDate: Date,
): Promise<void> {
  for (const item of items) {
    const existing = await (tx as any).stockBalance.findUnique({
      where: { organizationId_productId: { organizationId, productId: item.productId } },
    });

    if (existing) {
      const prevQty = toNumber(existing.currentQuantity);
      const prevAvg = toNumber(existing.averageCost);
      const prevTotal = prevQty * prevAvg;
      const newTotal = prevTotal + item.finalTotalCost;
      const newQty = prevQty + item.quantity;
      const newAvgCost = newQty > 0 ? newTotal / newQty : 0;

      await (tx as any).stockBalance.update({
        where: { id: existing.id },
        data: {
          currentQuantity: newQty,
          averageCost: newAvgCost,
          totalValue: newTotal,
          lastEntryDate: entryDate,
        },
      });
    } else {
      const avgCost = item.quantity > 0 ? item.finalTotalCost / item.quantity : 0;
      await (tx as any).stockBalance.create({
        data: {
          organizationId,
          productId: item.productId,
          currentQuantity: item.quantity,
          averageCost: avgCost,
          totalValue: item.finalTotalCost,
          lastEntryDate: entryDate,
        },
      });
    }
  }
}

// ─── Revert Stock Balance (for cancel) ──────────────────────────────

async function revertStockBalances(
  tx: TxClient,
  organizationId: string,
  items: Array<{
    productId: string;
    quantity: number;
    finalTotalCost: number;
  }>,
): Promise<void> {
  for (const item of items) {
    const existing = await (tx as any).stockBalance.findUnique({
      where: { organizationId_productId: { organizationId, productId: item.productId } },
    });

    if (existing) {
      const prevQty = toNumber(existing.currentQuantity);
      const prevTotal = toNumber(existing.totalValue);
      const newQty = prevQty - item.quantity;
      const newTotal = prevTotal - item.finalTotalCost;
      const newAvgCost = newQty > 0 ? newTotal / newQty : 0;

      await (tx as any).stockBalance.update({
        where: { id: existing.id },
        data: {
          currentQuantity: Math.max(0, newQty),
          averageCost: Math.max(0, newAvgCost),
          totalValue: Math.max(0, newTotal),
        },
      });
    }
  }
}

// ─── Formatters ─────────────────────────────────────────────────────

function formatItem(item: any): StockEntryItemOutput {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product?.name || '',
    quantity: toNumber(item.quantity),
    unitCost: toNumber(item.unitCost),
    totalCost: toNumber(item.totalCost),
    batchNumber: item.batchNumber,
    manufacturingDate: item.manufacturingDate?.toISOString() || null,
    expirationDate: item.expirationDate?.toISOString() || null,
    apportionedExpenses: toNumber(item.apportionedExpenses),
    finalUnitCost: toNumber(item.finalUnitCost),
    finalTotalCost: toNumber(item.finalTotalCost),
    weightKg: item.weightKg != null ? toNumber(item.weightKg) : null,
  };
}

function formatExpense(expense: any): StockEntryExpenseOutput {
  return {
    id: expense.id,
    expenseType: expense.expenseType,
    expenseTypeLabel:
      EXPENSE_TYPE_LABELS[expense.expenseType as ExpenseTypeValue] || expense.expenseType,
    description: expense.description,
    supplierName: expense.supplierName,
    invoiceNumber: expense.invoiceNumber,
    amount: toNumber(expense.amount),
    apportionmentMethod: expense.apportionmentMethod,
    isRetroactive: expense.isRetroactive,
  };
}

function formatEntry(entry: any): StockEntryOutput {
  return {
    id: entry.id,
    entryDate: entry.entryDate.toISOString(),
    status: entry.status,
    supplierName: entry.supplierName,
    invoiceNumber: entry.invoiceNumber,
    storageFarmId: entry.storageFarmId,
    storageFarmName: entry.storageFarm?.name || null,
    storageLocation: entry.storageLocation,
    storageSublocation: entry.storageSublocation,
    notes: entry.notes,
    totalMerchandiseCost: toNumber(entry.totalMerchandiseCost),
    totalExpensesCost: toNumber(entry.totalExpensesCost),
    totalCost: toNumber(entry.totalCost),
    items: (entry.items || []).map(formatItem),
    expenses: (entry.expenses || []).map(formatExpense),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

// ─── Include clause ─────────────────────────────────────────────────

const entryInclude = {
  items: {
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  expenses: { orderBy: { createdAt: 'asc' as const } },
  storageFarm: { select: { name: true } },
};

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createStockEntry(
  ctx: RlsContext,
  input: CreateStockEntryInput,
  userId?: string,
): Promise<{ entry: StockEntryOutput; costAlerts: CostAlert[] }> {
  validateItems(input.items);
  if (input.expenses) {
    for (const exp of input.expenses) {
      validateExpense(exp);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate products exist and are PRODUCT nature (not SERVICE)
    for (const item of input.items) {
      const product = await (tx as any).product.findFirst({
        where: {
          id: item.productId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });
      if (!product) {
        throw new StockEntryError(`Produto não encontrado: ${item.productId}`, 404);
      }
      if (product.nature === 'SERVICE') {
        throw new StockEntryError(
          `"${product.name}" é um serviço e não pode ter entrada no estoque`,
          400,
        );
      }
    }

    // Validate farm if provided
    if (input.storageFarmId) {
      const farm = await (tx as any).farm.findFirst({
        where: { id: input.storageFarmId, organizationId: ctx.organizationId, deletedAt: null },
      });
      if (!farm) {
        throw new StockEntryError('Fazenda de armazenamento não encontrada', 404);
      }
    }

    // Check cost divergence alerts (CA9)
    const costAlerts = await checkCostDivergence(tx, ctx.organizationId, input.items);

    // Calculate item totals
    const itemsWithTotals = input.items.map((item) => ({
      ...item,
      totalCost: item.quantity * item.unitCost,
    }));

    // Calculate apportionment
    const expenseInputs = (input.expenses || []).map((exp) => ({
      amount: exp.amount,
      apportionmentMethod: exp.apportionmentMethod || 'BY_VALUE',
    }));
    const apportionments = apportionExpenses(
      itemsWithTotals.map((i) => ({
        totalCost: i.totalCost,
        quantity: i.quantity,
        weightKg: i.weightKg ?? null,
      })),
      expenseInputs,
    );

    const totalMerchandiseCost = itemsWithTotals.reduce((s, i) => s + i.totalCost, 0);
    const totalExpensesCost = (input.expenses || []).reduce((s, e) => s + e.amount, 0);
    const totalCost = totalMerchandiseCost + totalExpensesCost;

    const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();

    // Create entry
    const entry = await (tx as any).stockEntry.create({
      data: {
        organizationId: ctx.organizationId,
        entryDate,
        status: 'CONFIRMED',
        supplierName: input.supplierName?.trim() || null,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        storageFarmId: input.storageFarmId || null,
        storageLocation: input.storageLocation?.trim() || null,
        storageSublocation: input.storageSublocation?.trim() || null,
        notes: input.notes?.trim() || null,
        totalMerchandiseCost,
        totalExpensesCost,
        totalCost,
        createdBy: userId || null,
        items: {
          create: itemsWithTotals.map((item, idx) => {
            const apportioned = apportionments[idx];
            const finalTotal = item.totalCost + apportioned;
            const finalUnit = item.quantity > 0 ? finalTotal / item.quantity : 0;
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
              batchNumber: item.batchNumber?.trim() || null,
              manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
              expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
              weightKg: item.weightKg ?? null,
              apportionedExpenses: apportioned,
              finalUnitCost: finalUnit,
              finalTotalCost: finalTotal,
            };
          }),
        },
        expenses: input.expenses?.length
          ? {
              create: input.expenses.map((exp) => ({
                expenseType: exp.expenseType,
                description: exp.description?.trim() || null,
                supplierName: exp.supplierName?.trim() || null,
                invoiceNumber: exp.invoiceNumber?.trim() || null,
                amount: exp.amount,
                apportionmentMethod: exp.apportionmentMethod || 'BY_VALUE',
                isRetroactive: false,
              })),
            }
          : undefined,
      },
      include: entryInclude,
    });

    // Update stock balances (CA5)
    await updateStockBalances(
      tx,
      ctx.organizationId,
      itemsWithTotals.map((item, idx) => ({
        productId: item.productId,
        quantity: item.quantity,
        finalTotalCost: item.totalCost + apportionments[idx],
      })),
      entryDate,
    );

    return { entry: formatEntry(entry), costAlerts };
  });
}

// ─── ADD RETROACTIVE EXPENSE (CA6) ─────────────────────────────────

export async function addRetroactiveExpense(
  ctx: RlsContext,
  entryId: string,
  input: AddExpenseInput,
): Promise<StockEntryOutput> {
  validateExpense(input);

  return withRlsContext(ctx, async (tx) => {
    const entry = await (tx as any).stockEntry.findFirst({
      where: { id: entryId, organizationId: ctx.organizationId },
      include: entryInclude,
    });
    if (!entry) {
      throw new StockEntryError('Entrada não encontrada', 404);
    }
    if (entry.status === 'CANCELLED') {
      throw new StockEntryError('Não é possível adicionar despesa a uma entrada cancelada', 400);
    }

    // Revert previous stock balances for this entry
    const prevItems = entry.items.map((i: any) => ({
      productId: i.productId,
      quantity: toNumber(i.quantity),
      finalTotalCost: toNumber(i.finalTotalCost),
    }));
    await revertStockBalances(tx, ctx.organizationId, prevItems);

    // Add new expense
    await (tx as any).stockEntryExpense.create({
      data: {
        stockEntryId: entryId,
        expenseType: input.expenseType,
        description: input.description?.trim() || null,
        supplierName: input.supplierName?.trim() || null,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        amount: input.amount,
        apportionmentMethod: input.apportionmentMethod || 'BY_VALUE',
        isRetroactive: true,
      },
    });

    // Reload all expenses and recalculate
    const allExpenses = await (tx as any).stockEntryExpense.findMany({
      where: { stockEntryId: entryId },
    });

    const items = entry.items.map((i: any) => ({
      totalCost: toNumber(i.totalCost),
      quantity: toNumber(i.quantity),
      weightKg: i.weightKg != null ? toNumber(i.weightKg) : null,
    }));

    const apportionments = apportionExpenses(
      items,
      allExpenses.map((e: any) => ({
        amount: toNumber(e.amount),
        apportionmentMethod: e.apportionmentMethod,
      })),
    );

    const totalExpensesCost = allExpenses.reduce((s: number, e: any) => s + toNumber(e.amount), 0);
    const totalMerchandiseCost = toNumber(entry.totalMerchandiseCost);

    // Update each item with new apportioned costs
    for (let i = 0; i < entry.items.length; i++) {
      const item = entry.items[i] as any;
      const apportioned = apportionments[i];
      const itemTotalCost = toNumber(item.totalCost);
      const finalTotal = itemTotalCost + apportioned;
      const qty = toNumber(item.quantity);
      const finalUnit = qty > 0 ? finalTotal / qty : 0;

      await (tx as any).stockEntryItem.update({
        where: { id: item.id },
        data: {
          apportionedExpenses: apportioned,
          finalUnitCost: finalUnit,
          finalTotalCost: finalTotal,
        },
      });
    }

    // Update entry totals
    await (tx as any).stockEntry.update({
      where: { id: entryId },
      data: {
        totalExpensesCost,
        totalCost: totalMerchandiseCost + totalExpensesCost,
      },
    });

    // Recalculate stock balances
    const newItems = entry.items.map((item: any, idx: number) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity),
      finalTotalCost: toNumber(item.totalCost) + apportionments[idx],
    }));
    await updateStockBalances(tx, ctx.organizationId, newItems, entry.entryDate);

    // Reload and return
    const updated = await (tx as any).stockEntry.findUnique({
      where: { id: entryId },
      include: entryInclude,
    });

    return formatEntry(updated);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listStockEntries(
  ctx: RlsContext,
  query: ListStockEntriesQuery,
): Promise<ListStockEntriesResult> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: any = { organizationId: ctx.organizationId };

    if (query.status) where.status = query.status;
    if (query.supplierName) {
      where.supplierName = { contains: query.supplierName, mode: 'insensitive' };
    }
    if (query.dateFrom || query.dateTo) {
      where.entryDate = {};
      if (query.dateFrom) where.entryDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.entryDate.lte = new Date(query.dateTo);
    }
    if (query.productId) {
      where.items = { some: { productId: query.productId } };
    }

    const [data, total] = await Promise.all([
      (tx as any).stockEntry.findMany({
        where,
        include: entryInclude,
        orderBy: { entryDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).stockEntry.count({ where }),
    ]);

    return {
      data: data.map(formatEntry),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getStockEntry(ctx: RlsContext, id: string): Promise<StockEntryOutput> {
  return withRlsContext(ctx, async (tx) => {
    const entry = await (tx as any).stockEntry.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: entryInclude,
    });
    if (!entry) {
      throw new StockEntryError('Entrada não encontrada', 404);
    }
    return formatEntry(entry);
  });
}

// ─── CANCEL ─────────────────────────────────────────────────────────

export async function cancelStockEntry(ctx: RlsContext, id: string): Promise<StockEntryOutput> {
  return withRlsContext(ctx, async (tx) => {
    const entry = await (tx as any).stockEntry.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: entryInclude,
    });
    if (!entry) {
      throw new StockEntryError('Entrada não encontrada', 404);
    }
    if (entry.status === 'CANCELLED') {
      throw new StockEntryError('Entrada já está cancelada', 400);
    }

    // Revert stock balances
    const items = entry.items.map((i: any) => ({
      productId: i.productId,
      quantity: toNumber(i.quantity),
      finalTotalCost: toNumber(i.finalTotalCost),
    }));
    await revertStockBalances(tx, ctx.organizationId, items);

    // Mark as cancelled
    const updated = await (tx as any).stockEntry.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: entryInclude,
    });

    return formatEntry(updated);
  });
}

// ─── STOCK BALANCES ─────────────────────────────────────────────────

export async function listStockBalances(
  ctx: RlsContext,
  query: { page?: number; limit?: number; search?: string; belowMinimum?: boolean },
): Promise<{
  data: StockBalanceOutput[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: any = { organizationId: ctx.organizationId };
    if (query.search) {
      where.product = { name: { contains: query.search, mode: 'insensitive' } };
    }

    const [data, total] = await Promise.all([
      (tx as any).stockBalance.findMany({
        where,
        include: {
          product: {
            select: { name: true, type: true, measurementUnit: { select: { abbreviation: true } } },
          },
        },
        orderBy: { product: { name: 'asc' } },
        skip,
        take: limit,
      }),
      (tx as any).stockBalance.count({ where }),
    ]);

    return {
      data: data.map(
        (b: any): StockBalanceOutput => ({
          id: b.id,
          productId: b.productId,
          productName: b.product?.name || '',
          productType: b.product?.type || '',
          measurementUnit: b.product?.measurementUnit?.abbreviation || null,
          currentQuantity: toNumber(b.currentQuantity),
          averageCost: toNumber(b.averageCost),
          totalValue: toNumber(b.totalValue),
          lastEntryDate: b.lastEntryDate?.toISOString() || null,
        }),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}
