import type { SupplierCategory, PayableCategory, PayableStatus } from '@prisma/client';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PurchaseBudgetError,
  BUDGET_PERIOD_LABELS,
  SUPPLIER_CATEGORY_LABELS,
  type CreatePurchaseBudgetInput,
  type UpdatePurchaseBudgetInput,
  type ListPurchaseBudgetsQuery,
  type PurchaseBudgetOutput,
  type ListPurchaseBudgetsResult,
  type BudgetExecutionRow,
  type BudgetExecutionResult,
  type BudgetCheckResult,
  type BudgetPeriodTypeValue,
} from './purchase-budgets.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Formatter ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatBudget(b: any): PurchaseBudgetOutput {
  return {
    id: b.id,
    organizationId: b.organizationId,
    farmId: b.farmId ?? null,
    costCenterId: b.costCenterId ?? null,
    category: b.category,
    categoryLabel: SUPPLIER_CATEGORY_LABELS[b.category] ?? b.category,
    periodType: b.periodType as BudgetPeriodTypeValue,
    periodTypeLabel: BUDGET_PERIOD_LABELS[b.periodType as BudgetPeriodTypeValue] ?? b.periodType,
    periodStart:
      b.periodStart instanceof Date ? b.periodStart.toISOString() : String(b.periodStart),
    periodEnd: b.periodEnd instanceof Date ? b.periodEnd.toISOString() : String(b.periodEnd),
    budgetedAmount: String(b.budgetedAmount),
    notes: b.notes ?? null,
    createdBy: b.createdBy,
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt),
    updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : String(b.updatedAt),
  };
}

// ─── Create ──────────────────────────────────────────────────────────

export async function createPurchaseBudget(
  ctx: RlsContext & { userId: string },
  input: CreatePurchaseBudgetInput,
): Promise<PurchaseBudgetOutput> {
  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);

  if (periodEnd <= periodStart) {
    throw new PurchaseBudgetError('Data fim deve ser posterior a data inicio', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Check for overlapping budget: same org + category + farm + overlapping period
    const overlap = await tx.purchaseBudget.findFirst({
      where: {
        organizationId: ctx.organizationId,
        category: input.category as SupplierCategory,
        farmId: input.farmId ?? null,
        AND: [{ periodStart: { lte: periodEnd } }, { periodEnd: { gte: periodStart } }],
      },
    });

    if (overlap) {
      throw new PurchaseBudgetError('Ja existe orcamento para esta categoria no periodo', 409);
    }

    const budget = await tx.purchaseBudget.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId ?? null,
        costCenterId: input.costCenterId ?? null,
        category: input.category as SupplierCategory,
        periodType: input.periodType,
        periodStart,
        periodEnd,
        budgetedAmount: input.budgetedAmount,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
      },
    });

    return formatBudget(budget);
  });
}

// ─── Update ──────────────────────────────────────────────────────────

export async function updatePurchaseBudget(
  ctx: RlsContext,
  id: string,
  input: UpdatePurchaseBudgetInput,
): Promise<PurchaseBudgetOutput> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.purchaseBudget.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new PurchaseBudgetError('Orcamento nao encontrado', 404);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (input.budgetedAmount !== undefined) data.budgetedAmount = input.budgetedAmount;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.periodEnd !== undefined) {
      const newPeriodEnd = new Date(input.periodEnd);
      if (newPeriodEnd <= existing.periodStart) {
        throw new PurchaseBudgetError('Data fim deve ser posterior a data inicio', 400);
      }
      data.periodEnd = newPeriodEnd;
    }

    const updated = await tx.purchaseBudget.update({
      where: { id },
      data,
    });

    return formatBudget(updated);
  });
}

// ─── List ─────────────────────────────────────────────────────────────

export async function listPurchaseBudgets(
  ctx: RlsContext,
  query: ListPurchaseBudgetsQuery,
): Promise<ListPurchaseBudgetsResult> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId: ctx.organizationId,
  };

  if (query.farmId) where.farmId = query.farmId;
  if (query.category) where.category = query.category as SupplierCategory;
  if (query.periodType) where.periodType = query.periodType;
  if (query.periodStart) where.periodStart = { gte: new Date(query.periodStart) };
  if (query.periodEnd) where.periodEnd = { lte: new Date(query.periodEnd) };

  return withRlsContext(ctx, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.purchaseBudget.findMany({
        where,
        skip,
        take: limit,
        orderBy: { periodStart: 'desc' },
      }),
      tx.purchaseBudget.count({ where }),
    ]);

    return {
      data: rows.map(formatBudget),
      total,
      page,
      limit,
    };
  });
}

// ─── Get by ID ────────────────────────────────────────────────────────

export async function getPurchaseBudgetById(
  ctx: RlsContext,
  id: string,
): Promise<PurchaseBudgetOutput> {
  return withRlsContext(ctx, async (tx) => {
    const budget = await tx.purchaseBudget.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!budget) {
      throw new PurchaseBudgetError('Orcamento nao encontrado', 404);
    }

    return formatBudget(budget);
  });
}

// ─── Delete ───────────────────────────────────────────────────────────

export async function deletePurchaseBudget(
  ctx: RlsContext,
  id: string,
): Promise<{ success: boolean }> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.purchaseBudget.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new PurchaseBudgetError('Orcamento nao encontrado', 404);
    }

    await tx.purchaseBudget.delete({ where: { id } });

    return { success: true };
  });
}

// ─── Budget Execution ─────────────────────────────────────────────────

export async function getBudgetExecution(
  ctx: RlsContext,
  query: { farmId?: string; periodStart?: string; periodEnd?: string },
): Promise<BudgetExecutionResult> {
  return withRlsContext(ctx, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
    };
    if (query.farmId) where.farmId = query.farmId;
    if (query.periodStart) where.periodStart = { gte: new Date(query.periodStart) };
    if (query.periodEnd) where.periodEnd = { lte: new Date(query.periodEnd) };

    const budgets = await tx.purchaseBudget.findMany({
      where,
      include: {
        // Include farm name if farmId is set
      },
      orderBy: { periodStart: 'desc' },
    });

    const rows: BudgetExecutionRow[] = [];

    let totalBudgeted = 0;
    let totalRequisitado = 0;
    let totalComprado = 0;
    let totalPago = 0;

    for (const budget of budgets) {
      // Calculate requisitado: sum of PurchaseRequestItem estimated totals
      // where RC status is APROVADA, EM_COTACAO, or COMPRADA
      // and RC was created between budget period, matching category (requestType)
      const rcItems = await tx.purchaseRequestItem.findMany({
        where: {
          purchaseRequest: {
            organizationId: ctx.organizationId,
            requestType: budget.category,
            farmId: budget.farmId ?? undefined,
            status: { in: ['APROVADA'] },
            createdAt: {
              gte: budget.periodStart,
              lte: budget.periodEnd,
            },
          },
          estimatedUnitPrice: { not: null },
        },
        select: {
          quantity: true,
          estimatedUnitPrice: true,
        },
      });

      const requisitado = rcItems.reduce(
        (sum: number, item: TxClient) =>
          sum + Number(item.quantity) * Number(item.estimatedUnitPrice),
        0,
      );

      // Calculate comprado: sum of PurchaseOrderItem totalPrice
      // where OC status is EMITIDA, CONFIRMADA, EM_TRANSITO, or ENTREGUE
      // and OC was created between budget period
      // Link via purchaseRequestItemId -> purchaseRequestItem -> purchaseRequest.requestType
      const ocItems = await tx.purchaseOrderItem.findMany({
        where: {
          purchaseOrder: {
            organizationId: ctx.organizationId,
            status: { in: ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO', 'ENTREGUE'] },
            createdAt: {
              gte: budget.periodStart,
              lte: budget.periodEnd,
            },
          },
          // Only include items linked to RCs of the matching category
          purchaseRequestItemId: {
            not: null,
          },
        },
        select: {
          totalPrice: true,
          purchaseRequestItemId: true,
        },
      });

      // Filter ocItems to those whose RC matches the budget category
      let comprado = 0;
      for (const ocItem of ocItems) {
        if (ocItem.purchaseRequestItemId) {
          const rcItem = await tx.purchaseRequestItem.findFirst({
            where: { id: ocItem.purchaseRequestItemId },
            include: {
              purchaseRequest: {
                select: { requestType: true, farmId: true },
              },
            },
          });
          if (
            rcItem?.purchaseRequest?.requestType === budget.category &&
            (!budget.farmId || rcItem?.purchaseRequest?.farmId === budget.farmId)
          ) {
            comprado += Number(ocItem.totalPrice);
          }
        } else {
          // No RC link — cannot determine category, skip
        }
      }

      // Calculate pago: sum of Payable.totalAmount where status PAGA
      // and paidAt between budget period
      // Payable.category maps to PayableCategory — map SupplierCategory to PayableCategory
      const payableCategory = mapSupplierCategoryToPayable(budget.category);

      let pago = 0;
      if (payableCategory) {
        const payables = await tx.payable.findMany({
          where: {
            organizationId: ctx.organizationId,
            farmId: budget.farmId ?? undefined,
            category: payableCategory as PayableCategory,
            status: 'PAID' as PayableStatus,
            isCredit: false,
            paidAt: {
              gte: budget.periodStart,
              lte: budget.periodEnd,
            },
          },
          select: { totalAmount: true },
        });
        pago = payables.reduce((sum: number, p: TxClient) => sum + Number(p.totalAmount), 0);
      }

      const budgetedAmount = Number(budget.budgetedAmount);
      const percentUsed = budgetedAmount > 0 ? (comprado / budgetedAmount) * 100 : 0;

      // Get farm name if farmId set
      let farmName: string | null = null;
      if (budget.farmId) {
        const farm = await tx.farm.findFirst({
          where: { id: budget.farmId },
          select: { name: true },
        });
        farmName = farm?.name ?? null;
      }

      rows.push({
        budgetId: budget.id,
        category: budget.category,
        categoryLabel: SUPPLIER_CATEGORY_LABELS[budget.category] ?? budget.category,
        farmId: budget.farmId ?? null,
        farmName,
        periodStart:
          budget.periodStart instanceof Date
            ? budget.periodStart.toISOString()
            : String(budget.periodStart),
        periodEnd:
          budget.periodEnd instanceof Date
            ? budget.periodEnd.toISOString()
            : String(budget.periodEnd),
        budgetedAmount: String(budgetedAmount),
        requisitado: String(requisitado),
        comprado: String(comprado),
        pago: String(pago),
        percentUsed,
      });

      totalBudgeted += budgetedAmount;
      totalRequisitado += requisitado;
      totalComprado += comprado;
      totalPago += pago;
    }

    return {
      rows,
      totals: {
        budgeted: String(totalBudgeted),
        requisitado: String(totalRequisitado),
        comprado: String(totalComprado),
        pago: String(totalPago),
      },
    };
  });
}

// ─── Deviation Report ─────────────────────────────────────────────────

export async function getDeviationReport(
  ctx: RlsContext,
  query: { farmId?: string; periodStart?: string; periodEnd?: string },
) {
  const execution = await getBudgetExecution(ctx, query);
  return execution.rows.filter((row) => row.percentUsed > 100);
}

// ─── Check Budget Exceeded ────────────────────────────────────────────

export async function checkBudgetExceeded(
  tx: TxClient,
  organizationId: string,
  category: string,
  farmId: string | null,
  amount: number,
): Promise<BudgetCheckResult> {
  const now = new Date();

  // Find active budget for this category + farm
  const budget = await tx.purchaseBudget.findFirst({
    where: {
      organizationId,
      category,
      farmId: farmId ?? null,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
  });

  if (!budget) {
    return { exceeded: false };
  }

  // Calculate current "comprado" total for this budget
  // Only OC items linked to RCs of the matching category
  const ocItems = await tx.purchaseOrderItem.findMany({
    where: {
      purchaseOrder: {
        organizationId,
        status: { in: ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO', 'ENTREGUE'] },
        createdAt: {
          gte: budget.periodStart,
          lte: budget.periodEnd,
        },
      },
      purchaseRequestItemId: { not: null },
    },
    select: { totalPrice: true, purchaseRequestItemId: true },
  });

  let currentSpent = 0;
  for (const ocItem of ocItems) {
    if (ocItem.purchaseRequestItemId) {
      const rcItem = await tx.purchaseRequestItem.findFirst({
        where: { id: ocItem.purchaseRequestItemId },
        include: {
          purchaseRequest: { select: { requestType: true, farmId: true } },
        },
      });
      if (
        rcItem?.purchaseRequest?.requestType === category &&
        (!farmId || rcItem?.purchaseRequest?.farmId === farmId)
      ) {
        currentSpent += Number(ocItem.totalPrice);
      }
    }
  }

  const budgetedAmount = Number(budget.budgetedAmount);
  const percentUsed = budgetedAmount > 0 ? ((currentSpent + amount) / budgetedAmount) * 100 : 0;

  if (currentSpent + amount > budgetedAmount) {
    return {
      exceeded: true,
      budgetId: budget.id,
      budgetedAmount: String(budgetedAmount),
      currentSpent: String(currentSpent),
      percentUsed,
    };
  }

  return { exceeded: false };
}

// ─── Helper: Map SupplierCategory to PayableCategory ─────────────────

function mapSupplierCategoryToPayable(category: string): string | null {
  const map: Record<string, string> = {
    INSUMO_AGRICOLA: 'INPUTS',
    PECUARIO: 'INPUTS',
    PECAS: 'MAINTENANCE',
    COMBUSTIVEL: 'OTHER',
    EPI: 'OTHER',
    SERVICOS: 'SERVICES',
    OUTROS: 'OTHER',
  };
  return map[category] ?? null;
}
