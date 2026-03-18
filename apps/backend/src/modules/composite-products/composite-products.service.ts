import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  CompositeProductError,
  COMPOSITE_TYPES,
  COMPOSITE_TYPE_LABELS,
  type CompositeTypeValue,
  type SetCompositeInput,
  type RecordProductionInput,
  type ListProductionsQuery,
  type CompositeProductDetail,
  type CompositeIngredientItem,
  type ProductionItem,
  type ProductionItemDetail,
} from './composite-products.types';
import {
  createConsumptionOutput,
  cancelConsumptionOutput,
} from '../stock-deduction/stock-deduction';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

// ─── Get Composite Detail (CA13 + CA15) ─────────────────────────────

export async function getCompositeDetail(
  ctx: RlsContext,
  productId: string,
): Promise<CompositeProductDetail> {
  return withRlsContext(ctx, async (tx) => {
    const product = await (tx as any).product.findFirst({
      where: { id: productId, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        compositeIngredients: {
          include: {
            ingredientProduct: {
              select: { name: true, measurementUnit: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new CompositeProductError('Produto não encontrado', 404);
    }

    if (!product.isComposite) {
      throw new CompositeProductError('Este produto não é um produto composto', 400);
    }

    const compositeType = (product.compositeType as CompositeTypeValue) || 'outro';

    // Calculate cost from StockBalance for each ingredient
    const ingredients: CompositeIngredientItem[] = [];
    let estimatedCostCents = 0;

    for (const ing of product.compositeIngredients) {
      const balance = await (tx as any).stockBalance.findFirst({
        where: {
          organizationId: ctx.organizationId,
          productId: ing.ingredientProductId,
        },
      });

      const avgCost = balance ? toNumber(balance.averageCost) : 0;
      const qtyPerBatch = toNumber(ing.quantityPerBatch);
      const ingredientCost = Math.round(avgCost * qtyPerBatch * 100);

      ingredients.push({
        id: ing.id,
        ingredientProductId: ing.ingredientProductId,
        ingredientProductName: ing.ingredientProduct.name,
        ingredientMeasurementUnit: ing.ingredientProduct.measurementUnit ?? null,
        quantityPerBatch: qtyPerBatch,
        unitCostCents: Math.round(avgCost * 100),
        sortOrder: ing.sortOrder,
        notes: ing.notes ?? null,
      });

      estimatedCostCents += ingredientCost;
    }

    return {
      productId: product.id,
      productName: product.name,
      compositeType,
      compositeTypeLabel: COMPOSITE_TYPE_LABELS[compositeType] ?? compositeType,
      batchSize: toNumber(product.batchSize),
      batchUnit: product.batchUnit ?? '',
      ingredients,
      estimatedCostCents,
    };
  });
}

// ─── Set Composite Ingredients (CA13 + CA14) ────────────────────────

export async function setCompositeIngredients(
  ctx: RlsContext,
  productId: string,
  input: SetCompositeInput,
): Promise<CompositeProductDetail> {
  // Validation
  if (!input.compositeType) {
    throw new CompositeProductError('Tipo de produto composto é obrigatório', 400);
  }
  if (!COMPOSITE_TYPES.includes(input.compositeType as CompositeTypeValue)) {
    throw new CompositeProductError(`Tipo inválido. Use: ${COMPOSITE_TYPES.join(', ')}`, 400);
  }
  if (!input.batchSize || input.batchSize <= 0) {
    throw new CompositeProductError('Tamanho do lote deve ser maior que zero', 400);
  }
  if (!input.batchUnit?.trim()) {
    throw new CompositeProductError('Unidade do lote é obrigatória', 400);
  }
  if (!input.ingredients || input.ingredients.length === 0) {
    throw new CompositeProductError('Pelo menos um ingrediente é obrigatório', 400);
  }

  for (const ing of input.ingredients) {
    if (!ing.ingredientProductId) {
      throw new CompositeProductError('Produto do ingrediente é obrigatório', 400);
    }
    if (!ing.quantityPerBatch || ing.quantityPerBatch <= 0) {
      throw new CompositeProductError('Quantidade por lote deve ser maior que zero', 400);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    const product = await (tx as any).product.findFirst({
      where: { id: productId, organizationId: ctx.organizationId, deletedAt: null },
    });

    if (!product) {
      throw new CompositeProductError('Produto não encontrado', 404);
    }

    // Verify all ingredient products exist
    for (const ing of input.ingredients) {
      if (ing.ingredientProductId === productId) {
        throw new CompositeProductError('Um produto não pode ser ingrediente de si mesmo', 400);
      }
      const ingProduct = await (tx as any).product.findFirst({
        where: { id: ing.ingredientProductId, organizationId: ctx.organizationId, deletedAt: null },
      });
      if (!ingProduct) {
        throw new CompositeProductError(
          `Produto ingrediente não encontrado: ${ing.ingredientProductId}`,
          404,
        );
      }
    }

    // Update product to be composite
    await (tx as any).product.update({
      where: { id: productId },
      data: {
        isComposite: true,
        compositeType: input.compositeType,
        batchSize: input.batchSize,
        batchUnit: input.batchUnit.trim(),
      },
    });

    // Delete old ingredients
    await (tx as any).compositeIngredient.deleteMany({
      where: { compositeProductId: productId },
    });

    // Create new ingredients
    await (tx as any).compositeIngredient.createMany({
      data: input.ingredients.map((ing, i) => ({
        compositeProductId: productId,
        ingredientProductId: ing.ingredientProductId,
        quantityPerBatch: ing.quantityPerBatch,
        sortOrder: ing.sortOrder ?? i,
        notes: ing.notes ?? null,
      })),
    });

    // Return full detail
    return getCompositeDetail(ctx, productId);
  });
}

// ─── Calculate Composite Cost (CA15) ────────────────────────────────

export async function calculateCompositeCost(ctx: RlsContext, productId: string): Promise<number> {
  return withRlsContext(ctx, async (tx) => {
    const ingredients = await (tx as any).compositeIngredient.findMany({
      where: { compositeProductId: productId },
    });

    let totalCostCents = 0;

    for (const ing of ingredients) {
      const balance = await (tx as any).stockBalance.findFirst({
        where: {
          organizationId: ctx.organizationId,
          productId: ing.ingredientProductId,
        },
      });

      const avgCost = balance ? toNumber(balance.averageCost) : 0;
      const qtyPerBatch = toNumber(ing.quantityPerBatch);
      totalCostCents += Math.round(avgCost * qtyPerBatch * 100);
    }

    return totalCostCents;
  });
}

// ─── Record Production (CA16) ───────────────────────────────────────

export async function recordProduction(
  ctx: RlsContext,
  userId: string,
  input: RecordProductionInput,
): Promise<ProductionItem> {
  // Validation
  if (!input.compositeProductId) {
    throw new CompositeProductError('Produto composto é obrigatório', 400);
  }
  if (!input.productionDate) {
    throw new CompositeProductError('Data de produção é obrigatória', 400);
  }
  const prodDate = new Date(input.productionDate);
  if (isNaN(prodDate.getTime())) {
    throw new CompositeProductError('Data de produção inválida', 400);
  }
  if (!input.quantityProduced || input.quantityProduced <= 0) {
    throw new CompositeProductError('Quantidade produzida deve ser maior que zero', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new CompositeProductError('Nome do responsável é obrigatório', 400);
  }
  if (!input.ingredients || input.ingredients.length === 0) {
    throw new CompositeProductError('Pelo menos um ingrediente consumido é obrigatório', 400);
  }

  for (const ing of input.ingredients) {
    if (!ing.productId) {
      throw new CompositeProductError('Produto do ingrediente é obrigatório', 400);
    }
    if (!ing.quantityUsed || ing.quantityUsed <= 0) {
      throw new CompositeProductError('Quantidade utilizada deve ser maior que zero', 400);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    // Load composite product
    const product = await (tx as any).product.findFirst({
      where: {
        id: input.compositeProductId,
        organizationId: ctx.organizationId,
        isComposite: true,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new CompositeProductError('Produto composto não encontrado', 404);
    }

    // Calculate costs from StockBalance
    const itemsWithCost: Array<{
      productId: string;
      productName: string;
      quantityUsed: number;
      unitCostCents: number;
      totalCostCents: number;
      sourceBatchNumber: string | null;
    }> = [];

    let totalCostCents = 0;

    for (const ing of input.ingredients) {
      const ingProduct = await (tx as any).product.findFirst({
        where: { id: ing.productId, organizationId: ctx.organizationId, deletedAt: null },
        select: { name: true },
      });

      if (!ingProduct) {
        throw new CompositeProductError(
          `Produto ingrediente não encontrado: ${ing.productId}`,
          404,
        );
      }

      const balance = await (tx as any).stockBalance.findFirst({
        where: {
          organizationId: ctx.organizationId,
          productId: ing.productId,
        },
      });

      const avgCost = balance ? toNumber(balance.averageCost) : 0;
      const unitCostCents = Math.round(avgCost * 100);
      const lineTotalCents = Math.round(avgCost * ing.quantityUsed * 100);

      itemsWithCost.push({
        productId: ing.productId,
        productName: ingProduct.name,
        quantityUsed: ing.quantityUsed,
        unitCostCents,
        totalCostCents: lineTotalCents,
        sourceBatchNumber: ing.sourceBatchNumber ?? null,
      });

      totalCostCents += lineTotalCents;
    }

    // a) Create stock output for ingredient consumption
    const deductionResult = await createConsumptionOutput(tx, {
      organizationId: ctx.organizationId,
      items: input.ingredients.map((ing) => ({
        productId: ing.productId,
        quantity: ing.quantityUsed,
      })),
      fieldOperationRef: `composite-production:${input.compositeProductId}`,
      outputDate: prodDate,
      responsibleName: input.responsibleName.trim(),
      notes: input.notes ?? `Produção de ${product.name}`,
    });

    const stockOutputId = deductionResult?.stockOutputId ?? null;

    // b) Create stock entry for produced composite
    const unitCost = input.quantityProduced > 0 ? totalCostCents / 100 / input.quantityProduced : 0;
    const totalCostDecimal = totalCostCents / 100;

    const stockEntry = await (tx as any).stockEntry.create({
      data: {
        organizationId: ctx.organizationId,
        entryDate: prodDate,
        status: 'CONFIRMED',
        supplierName: 'Produção interna',
        notes: `Produção de ${product.name} — lote ${input.batchNumber || 'S/N'}`,
        totalMerchandiseCost: totalCostDecimal,
        totalExpensesCost: 0,
        totalCost: totalCostDecimal,
        items: {
          create: [
            {
              productId: input.compositeProductId,
              quantity: input.quantityProduced,
              unitCost,
              totalCost: totalCostDecimal,
              batchNumber: input.batchNumber ?? null,
              apportionedExpenses: 0,
              finalUnitCost: unitCost,
              finalTotalCost: totalCostDecimal,
            },
          ],
        },
      },
      select: { id: true },
    });

    // c) Update StockBalance for produced composite
    const existingBalance = await (tx as any).stockBalance.findUnique({
      where: {
        organizationId_productId: {
          organizationId: ctx.organizationId,
          productId: input.compositeProductId,
        },
      },
    });

    if (existingBalance) {
      const prevQty = toNumber(existingBalance.currentQuantity);
      const prevAvg = toNumber(existingBalance.averageCost);
      const prevTotal = prevQty * prevAvg;
      const newTotal = prevTotal + totalCostDecimal;
      const newQty = prevQty + input.quantityProduced;
      const newAvgCost = newQty > 0 ? newTotal / newQty : 0;

      await (tx as any).stockBalance.update({
        where: { id: existingBalance.id },
        data: {
          currentQuantity: newQty,
          averageCost: newAvgCost,
          totalValue: newTotal,
          lastEntryDate: prodDate,
        },
      });
    } else {
      const avgCost = input.quantityProduced > 0 ? totalCostDecimal / input.quantityProduced : 0;
      await (tx as any).stockBalance.create({
        data: {
          organizationId: ctx.organizationId,
          productId: input.compositeProductId,
          currentQuantity: input.quantityProduced,
          averageCost: avgCost,
          totalValue: totalCostDecimal,
          lastEntryDate: prodDate,
        },
      });
    }

    // d) Create CompositeProduction record
    const production = await (tx as any).compositeProduction.create({
      data: {
        organizationId: ctx.organizationId,
        compositeProductId: input.compositeProductId,
        productionDate: prodDate,
        batchNumber: input.batchNumber ?? null,
        quantityProduced: input.quantityProduced,
        totalCostCents,
        responsibleName: input.responsibleName.trim(),
        notes: input.notes ?? null,
        stockEntryId: stockEntry.id,
        stockOutputId,
        recordedBy: userId,
        items: {
          create: itemsWithCost.map((item) => ({
            ingredientProductId: item.productId,
            ingredientProductName: item.productName,
            quantityUsed: item.quantityUsed,
            unitCostCents: item.unitCostCents,
            totalCostCents: item.totalCostCents,
            sourceBatchNumber: item.sourceBatchNumber,
          })),
        },
      },
      include: {
        compositeProduct: { select: { name: true } },
        items: true,
      },
    });

    return toProductionItem(production);
  });
}

// ─── List Productions ───────────────────────────────────────────────

export async function listProductions(
  ctx: RlsContext,
  query: ListProductionsQuery,
): Promise<{
  data: ProductionItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: any = { organizationId: ctx.organizationId };

    if (query.compositeProductId) {
      where.compositeProductId = query.compositeProductId;
    }
    if (query.dateFrom || query.dateTo) {
      where.productionDate = {};
      if (query.dateFrom) where.productionDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.productionDate.lte = new Date(query.dateTo);
    }

    const [rows, total] = await Promise.all([
      (tx as any).compositeProduction.findMany({
        where,
        include: {
          compositeProduct: { select: { name: true } },
          items: true,
        },
        orderBy: { productionDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).compositeProduction.count({ where }),
    ]);

    return {
      data: rows.map(toProductionItem),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── Get Production ─────────────────────────────────────────────────

export async function getProduction(
  ctx: RlsContext,
  productionId: string,
): Promise<ProductionItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).compositeProduction.findFirst({
      where: { id: productionId, organizationId: ctx.organizationId },
      include: {
        compositeProduct: { select: { name: true } },
        items: true,
      },
    });

    if (!row) {
      throw new CompositeProductError('Produção não encontrada', 404);
    }

    return toProductionItem(row);
  });
}

// ─── Delete Production ──────────────────────────────────────────────

export async function deleteProduction(ctx: RlsContext, productionId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const production = await (tx as any).compositeProduction.findFirst({
      where: { id: productionId, organizationId: ctx.organizationId },
      include: { items: true, compositeProduct: { select: { name: true } } },
    });

    if (!production) {
      throw new CompositeProductError('Produção não encontrada', 404);
    }

    // Cancel stock output (reverse ingredient deductions)
    if (production.stockOutputId) {
      await cancelConsumptionOutput(tx, ctx.organizationId, production.stockOutputId);
    }

    // Reverse stock entry (deduct produced composite from balance)
    if (production.stockEntryId) {
      const entryItems = await (tx as any).stockEntryItem.findMany({
        where: { stockEntryId: production.stockEntryId },
      });

      for (const item of entryItems) {
        const qty = toNumber(item.quantity);
        const cost = toNumber(item.finalTotalCost);

        const existing = await (tx as any).stockBalance.findUnique({
          where: {
            organizationId_productId: {
              organizationId: ctx.organizationId,
              productId: item.productId,
            },
          },
        });

        if (existing) {
          const prevQty = toNumber(existing.currentQuantity);
          const prevTotal = toNumber(existing.totalValue);
          const newQty = Math.max(0, prevQty - qty);
          const newTotal = Math.max(0, prevTotal - cost);
          const newAvgCost = newQty > 0 ? newTotal / newQty : 0;

          await (tx as any).stockBalance.update({
            where: { id: existing.id },
            data: {
              currentQuantity: newQty,
              averageCost: Math.max(0, newAvgCost),
              totalValue: newTotal,
            },
          });
        }
      }

      // Cancel stock entry
      await (tx as any).stockEntry.update({
        where: { id: production.stockEntryId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }

    // Delete the production record (items cascade)
    await (tx as any).compositeProduction.delete({
      where: { id: productionId },
    });
  });
}

// ─── Export Recipe (CA17) ───────────────────────────────────────────

export async function exportProductionRecipe(ctx: RlsContext, productId: string): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const product = await (tx as any).product.findFirst({
      where: {
        id: productId,
        organizationId: ctx.organizationId,
        isComposite: true,
        deletedAt: null,
      },
      include: {
        compositeIngredients: {
          include: {
            ingredientProduct: {
              select: { name: true, measurementUnit: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new CompositeProductError('Produto composto não encontrado', 404);
    }

    const compositeType = (product.compositeType as CompositeTypeValue) || 'outro';
    const typeLabel = COMPOSITE_TYPE_LABELS[compositeType] ?? compositeType;

    const header = ['Ordem', 'Ingrediente', 'Quantidade por Lote', 'Unidade', 'Observações'].join(
      ';',
    );

    const lines = product.compositeIngredients.map((ing: any, idx: number) => {
      return [
        idx + 1,
        ing.ingredientProduct.name,
        toNumber(ing.quantityPerBatch),
        ing.ingredientProduct.measurementUnit ?? '',
        ing.notes ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';');
    });

    const meta = [
      `"Receita de Produção"`,
      `"Produto";"${product.name}"`,
      `"Tipo";"${typeLabel}"`,
      `"Tamanho do Lote";"${toNumber(product.batchSize)} ${product.batchUnit || ''}"`,
      '',
    ].join('\n');

    return '\uFEFF' + meta + [header, ...lines].join('\n');
  });
}

// ─── Formatters ─────────────────────────────────────────────────────

function toProductionItem(row: any): ProductionItem {
  const items: ProductionItemDetail[] = (row.items ?? []).map((item: any) => ({
    ingredientProductId: item.ingredientProductId,
    ingredientProductName: item.ingredientProductName,
    quantityUsed: toNumber(item.quantityUsed),
    unitCostCents: item.unitCostCents,
    totalCostCents: item.totalCostCents,
    sourceBatchNumber: item.sourceBatchNumber ?? null,
  }));

  return {
    id: row.id,
    compositeProductId: row.compositeProductId,
    productName: row.compositeProduct?.name ?? '',
    productionDate: (row.productionDate as Date).toISOString().slice(0, 10),
    batchNumber: row.batchNumber ?? null,
    quantityProduced: toNumber(row.quantityProduced),
    totalCostCents: row.totalCostCents,
    responsibleName: row.responsibleName,
    stockEntryId: row.stockEntryId ?? null,
    stockOutputId: row.stockOutputId ?? null,
    items,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}
