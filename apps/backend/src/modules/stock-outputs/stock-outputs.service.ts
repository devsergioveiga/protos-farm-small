import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import { process as autoPost } from '../auto-posting/auto-posting.service';
import type { AutoPostingSourceType } from '@prisma/client';
import {
  StockOutputError,
  STOCK_OUTPUT_TYPES,
  STOCK_OUTPUT_TYPE_LABELS,
  DISPOSAL_REASONS,
  DISPOSAL_REASON_LABELS,
  type CreateStockOutputInput,
  type ListStockOutputsQuery,
  type StockOutputOutput,
  type StockOutputItemOutput,
  type ListStockOutputsResult,
  type InsufficientStockAlert,
  type StockOutputTypeValue,
  type DisposalReasonValue,
  type MovementHistoryEntry,
  type ListMovementsQuery,
  type ListMovementsResult,
} from './stock-outputs.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function validateItems(items: CreateStockOutputInput['items']): void {
  if (!items || items.length === 0) {
    throw new StockOutputError('Pelo menos um item é obrigatório', 400);
  }
  for (const item of items) {
    if (!item.productId?.trim()) {
      throw new StockOutputError('Produto é obrigatório em cada item', 400);
    }
    if (!item.quantity || item.quantity <= 0) {
      throw new StockOutputError('Quantidade deve ser maior que zero', 400);
    }
  }
}

// ─── Check Stock Availability (CA6) ────────────────────────────────

async function checkStockAvailability(
  tx: TxClient,
  organizationId: string,
  items: CreateStockOutputInput['items'],
): Promise<InsufficientStockAlert[]> {
  const alerts: InsufficientStockAlert[] = [];

  for (const item of items) {
    const balance = await (tx as any).stockBalance.findUnique({
      where: { organizationId_productId: { organizationId, productId: item.productId } },
    });

    const available = balance ? toNumber(balance.currentQuantity) : 0;

    if (available < item.quantity) {
      const product = await (tx as any).product.findUnique({
        where: { id: item.productId },
        select: { name: true },
      });
      alerts.push({
        productId: item.productId,
        productName: product?.name || item.productId,
        requested: item.quantity,
        available,
      });
    }
  }

  return alerts;
}

// ─── FEFO Batch Assignment (CA5) ────────────────────────────────────

async function assignBatchesFEFO(
  tx: TxClient,
  organizationId: string,
  items: CreateStockOutputInput['items'],
): Promise<Array<{ productId: string; quantity: number; batchNumber: string | null }>> {
  const result: Array<{ productId: string; quantity: number; batchNumber: string | null }> = [];

  for (const item of items) {
    if (item.batchNumber) {
      // Lote explicitamente informado
      result.push({
        productId: item.productId,
        quantity: item.quantity,
        batchNumber: item.batchNumber,
      });
      continue;
    }

    // Buscar lotes disponíveis via entradas confirmadas, ordenados por data de validade (FEFO)
    const batches = await (tx as any).stockEntryItem.findMany({
      where: {
        productId: item.productId,
        stockEntry: {
          organizationId,
          status: 'CONFIRMED',
        },
        expirationDate: { not: null },
      },
      orderBy: { expirationDate: 'asc' },
      select: { batchNumber: true, expirationDate: true },
    });

    if (batches.length > 0 && batches[0].batchNumber) {
      // Usa o lote com validade mais próxima
      result.push({
        productId: item.productId,
        quantity: item.quantity,
        batchNumber: batches[0].batchNumber,
      });
    } else {
      // Sem lotes com validade — saída sem lote
      result.push({
        productId: item.productId,
        quantity: item.quantity,
        batchNumber: null,
      });
    }
  }

  return result;
}

// ─── Update Stock Balance on Output ─────────────────────────────────

async function deductStockBalances(
  tx: TxClient,
  organizationId: string,
  items: Array<{ productId: string; quantity: number; totalCost: number }>,
): Promise<void> {
  for (const item of items) {
    const existing = await (tx as any).stockBalance.findUnique({
      where: { organizationId_productId: { organizationId, productId: item.productId } },
    });

    if (existing) {
      const prevQty = toNumber(existing.currentQuantity);
      const prevTotal = toNumber(existing.totalValue);
      const newQty = Math.max(0, prevQty - item.quantity);
      const newTotal = Math.max(0, prevTotal - item.totalCost);
      const newAvgCost = newQty > 0 ? newTotal / newQty : toNumber(existing.averageCost);

      await (tx as any).stockBalance.update({
        where: { id: existing.id },
        data: {
          currentQuantity: newQty,
          averageCost: newAvgCost,
          totalValue: newTotal,
        },
      });
    }
  }
}

// ─── Revert Stock Balance (for cancel) ──────────────────────────────

async function revertStockBalances(
  tx: TxClient,
  organizationId: string,
  items: Array<{ productId: string; quantity: number; totalCost: number }>,
): Promise<void> {
  for (const item of items) {
    const existing = await (tx as any).stockBalance.findUnique({
      where: { organizationId_productId: { organizationId, productId: item.productId } },
    });

    if (existing) {
      const prevQty = toNumber(existing.currentQuantity);
      const prevTotal = toNumber(existing.totalValue);
      const newQty = prevQty + item.quantity;
      const newTotal = prevTotal + item.totalCost;
      const newAvgCost = newQty > 0 ? newTotal / newQty : 0;

      await (tx as any).stockBalance.update({
        where: { id: existing.id },
        data: {
          currentQuantity: newQty,
          averageCost: newAvgCost,
          totalValue: newTotal,
        },
      });
    } else {
      const avgCost = item.quantity > 0 ? item.totalCost / item.quantity : 0;
      await (tx as any).stockBalance.create({
        data: {
          organizationId,
          productId: item.productId,
          currentQuantity: item.quantity,
          averageCost: avgCost,
          totalValue: item.totalCost,
        },
      });
    }
  }
}

// ─── Formatters ─────────────────────────────────────────────────────

function formatItem(item: any): StockOutputItemOutput {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product?.name || '',
    quantity: toNumber(item.quantity),
    unitCost: toNumber(item.unitCost),
    totalCost: toNumber(item.totalCost),
    batchNumber: item.batchNumber || null,
  };
}

function formatOutput(output: any): StockOutputOutput {
  const type = output.type as StockOutputTypeValue;
  const disposalReason = output.disposalReason as DisposalReasonValue | null;

  return {
    id: output.id,
    outputDate: output.outputDate.toISOString(),
    type,
    typeLabel: STOCK_OUTPUT_TYPE_LABELS[type] || type,
    status: output.status,
    fieldOperationRef: output.fieldOperationRef || null,
    fieldPlotId: output.fieldPlotId || null,
    sourceFarmId: output.sourceFarmId || null,
    sourceFarmName: output.sourceFarm?.name || null,
    sourceLocation: output.sourceLocation || null,
    destinationFarmId: output.destinationFarmId || null,
    destinationFarmName: output.destinationFarm?.name || null,
    destinationLocation: output.destinationLocation || null,
    disposalReason: disposalReason,
    disposalReasonLabel: disposalReason ? DISPOSAL_REASON_LABELS[disposalReason] : null,
    disposalJustification: output.disposalJustification || null,
    authorizedBy: output.authorizedBy || null,
    responsibleName: output.responsibleName || null,
    notes: output.notes || null,
    totalCost: toNumber(output.totalCost),
    items: (output.items || []).map(formatItem),
    createdAt: output.createdAt.toISOString(),
    updatedAt: output.updatedAt.toISOString(),
  };
}

// ─── Include clause ─────────────────────────────────────────────────

const outputInclude = {
  items: {
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  sourceFarm: { select: { name: true } },
  destinationFarm: { select: { name: true } },
};

// ─── Validate by type ───────────────────────────────────────────────

function validateByType(input: CreateStockOutputInput): void {
  if (!(STOCK_OUTPUT_TYPES as readonly string[]).includes(input.type)) {
    throw new StockOutputError(`Tipo inválido. Use: ${STOCK_OUTPUT_TYPES.join(', ')}`, 400);
  }

  if (input.type === 'TRANSFER') {
    if (!input.sourceFarmId && !input.sourceLocation) {
      throw new StockOutputError('Origem é obrigatória para transferência', 400);
    }
    if (!input.destinationFarmId && !input.destinationLocation) {
      throw new StockOutputError('Destino é obrigatório para transferência', 400);
    }
  }

  if (input.type === 'DISPOSAL') {
    if (!input.disposalReason) {
      throw new StockOutputError('Motivo do descarte é obrigatório', 400);
    }
    if (!(DISPOSAL_REASONS as readonly string[]).includes(input.disposalReason)) {
      throw new StockOutputError(`Motivo inválido. Use: ${DISPOSAL_REASONS.join(', ')}`, 400);
    }
    if (!input.authorizedBy?.trim()) {
      throw new StockOutputError('Autorização é obrigatória para descarte', 400);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CREATE (CA1, CA2, CA3, CA4, CA5, CA6, CA8)
// ═══════════════════════════════════════════════════════════════════════

export async function createStockOutput(
  ctx: RlsContext,
  input: CreateStockOutputInput,
): Promise<{ output: StockOutputOutput; insufficientStockAlerts: InsufficientStockAlert[] }> {
  validateItems(input.items);
  validateByType(input);

  const result = await withRlsContext(ctx, async (tx) => {
    // Check stock availability (CA6)
    const alerts = await checkStockAvailability(tx, ctx.organizationId, input.items);

    if (alerts.length > 0 && !input.forceInsufficientStock) {
      throw new StockOutputError(
        `Saldo insuficiente para: ${alerts.map((a) => `${a.productName} (disponível: ${a.available}, solicitado: ${a.requested})`).join('; ')}`,
        422,
      );
    }

    // FEFO batch assignment (CA5)
    const batchedItems = await assignBatchesFEFO(tx, ctx.organizationId, input.items);

    // Get average costs for each product
    const itemsWithCost: Array<{
      productId: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      batchNumber: string | null;
    }> = [];

    for (const item of batchedItems) {
      const balance = await (tx as any).stockBalance.findUnique({
        where: {
          organizationId_productId: {
            organizationId: ctx.organizationId,
            productId: item.productId,
          },
        },
      });
      const avgCost = balance ? toNumber(balance.averageCost) : 0;

      itemsWithCost.push({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: avgCost,
        totalCost: Math.round(avgCost * item.quantity * 100) / 100,
        batchNumber: item.batchNumber,
      });
    }

    const totalCost = itemsWithCost.reduce((sum, i) => sum + i.totalCost, 0);

    const created = await (tx as any).stockOutput.create({
      data: {
        organizationId: ctx.organizationId,
        outputDate: input.outputDate ? new Date(input.outputDate) : new Date(),
        type: input.type,
        status: 'CONFIRMED', // Saídas são confirmadas diretamente
        fieldOperationRef: input.fieldOperationRef || null,
        fieldPlotId: input.fieldPlotId || null,
        sourceFarmId: input.sourceFarmId || null,
        sourceLocation: input.sourceLocation || null,
        destinationFarmId: input.destinationFarmId || null,
        destinationLocation: input.destinationLocation || null,
        disposalReason: input.disposalReason || null,
        disposalJustification: input.disposalJustification || null,
        authorizedBy: input.authorizedBy || null,
        responsibleName: input.responsibleName || null,
        notes: input.notes || null,
        totalCost,
        createdBy: null,
        items: {
          create: itemsWithCost.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            batchNumber: item.batchNumber,
          })),
        },
      },
      include: outputInclude,
    });

    // Deduct from stock balance
    await deductStockBalances(
      tx,
      ctx.organizationId,
      itemsWithCost.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        totalCost: i.totalCost,
      })),
    );

    return {
      output: formatOutput(created),
      insufficientStockAlerts: alerts,
    };
  });

  // Auto-posting GL entry after stock output creation (non-blocking — per D-15)
  const sourceTypeMap: Record<string, AutoPostingSourceType> = {
    CONSUMPTION: 'STOCK_OUTPUT_CONSUMPTION',
    MANUAL_CONSUMPTION: 'STOCK_OUTPUT_CONSUMPTION',
    TRANSFER: 'STOCK_OUTPUT_TRANSFER',
    DISPOSAL: 'STOCK_OUTPUT_DISPOSAL',
  };
  const outputSourceType = sourceTypeMap[result.output.type] ?? 'STOCK_OUTPUT_CONSUMPTION';
  try {
    await autoPost(outputSourceType, result.output.id, ctx.organizationId);
  } catch (err) {
    console.error('[stock-outputs] Auto-posting failed:', err);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// GET BY ID
// ═══════════════════════════════════════════════════════════════════════

export async function getStockOutput(ctx: RlsContext, id: string): Promise<StockOutputOutput> {
  return withRlsContext(ctx, async (tx) => {
    const output = await (tx as any).stockOutput.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: outputInclude,
    });

    if (!output) {
      throw new StockOutputError('Saída não encontrada', 404);
    }

    return formatOutput(output);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// LIST (CA10)
// ═══════════════════════════════════════════════════════════════════════

export async function listStockOutputs(
  ctx: RlsContext,
  query: ListStockOutputsQuery,
): Promise<ListStockOutputsResult> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: any = { organizationId: ctx.organizationId };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.responsibleName) {
      where.responsibleName = { contains: query.responsibleName, mode: 'insensitive' };
    }
    if (query.dateFrom || query.dateTo) {
      where.outputDate = {};
      if (query.dateFrom) where.outputDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.outputDate.lte = new Date(query.dateTo);
    }
    if (query.productId) {
      where.items = { some: { productId: query.productId } };
    }

    const [data, total] = await Promise.all([
      (tx as any).stockOutput.findMany({
        where,
        include: outputInclude,
        orderBy: { outputDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).stockOutput.count({ where }),
    ]);

    return {
      data: data.map(formatOutput),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// CANCEL
// ═══════════════════════════════════════════════════════════════════════

export async function cancelStockOutput(ctx: RlsContext, id: string): Promise<StockOutputOutput> {
  return withRlsContext(ctx, async (tx) => {
    const output = await (tx as any).stockOutput.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { items: true },
    });

    if (!output) {
      throw new StockOutputError('Saída não encontrada', 404);
    }

    if (output.status === 'CANCELLED') {
      throw new StockOutputError('Saída já está cancelada', 400);
    }

    // Revert stock balances if it was confirmed
    if (output.status === 'CONFIRMED') {
      await revertStockBalances(
        tx,
        ctx.organizationId,
        output.items.map((item: any) => ({
          productId: item.productId,
          quantity: toNumber(item.quantity),
          totalCost: toNumber(item.totalCost),
        })),
      );
    }

    const updated = await (tx as any).stockOutput.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
      include: outputInclude,
    });

    return formatOutput(updated);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MOVEMENT HISTORY (CA7, CA10)
// ═══════════════════════════════════════════════════════════════════════

export async function listMovementHistory(
  ctx: RlsContext,
  query: ListMovementsQuery,
): Promise<ListMovementsResult> {
  if (!query.productId?.trim()) {
    throw new StockOutputError('Produto é obrigatório para consultar movimentações', 400);
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));

  return withRlsContext(ctx, async (tx) => {
    const entries: MovementHistoryEntry[] = [];

    // Fetch ENTRIES (from stock_entry_items of confirmed entries)
    if (!query.movementType || query.movementType === 'ENTRY') {
      const entryWhere: any = {
        productId: query.productId,
        stockEntry: {
          organizationId: ctx.organizationId,
          status: 'CONFIRMED',
        },
      };

      if (query.dateFrom || query.dateTo) {
        entryWhere.stockEntry.entryDate = {};
        if (query.dateFrom) entryWhere.stockEntry.entryDate.gte = new Date(query.dateFrom);
        if (query.dateTo) entryWhere.stockEntry.entryDate.lte = new Date(query.dateTo);
      }

      const entryItems = await (tx as any).stockEntryItem.findMany({
        where: entryWhere,
        include: {
          stockEntry: {
            select: {
              id: true,
              entryDate: true,
              supplierName: true,
              notes: true,
            },
          },
        },
        orderBy: { stockEntry: { entryDate: 'desc' } },
      });

      for (const item of entryItems) {
        entries.push({
          id: item.id,
          date: item.stockEntry.entryDate.toISOString(),
          movementType: 'ENTRY',
          type: 'PURCHASE',
          typeLabel: 'Compra',
          quantity: toNumber(item.quantity),
          unitCost: toNumber(item.finalUnitCost || item.unitCost),
          totalCost: toNumber(item.finalTotalCost || item.totalCost),
          batchNumber: item.batchNumber || null,
          referenceId: item.stockEntry.id,
          responsibleName: item.stockEntry.supplierName || null,
          notes: item.stockEntry.notes || null,
        });
      }
    }

    // Fetch EXITS (from stock_output_items of confirmed outputs)
    if (!query.movementType || query.movementType === 'EXIT') {
      const outputWhere: any = {
        productId: query.productId,
        stockOutput: {
          organizationId: ctx.organizationId,
          status: 'CONFIRMED',
        },
      };

      if (query.dateFrom || query.dateTo) {
        outputWhere.stockOutput.outputDate = {};
        if (query.dateFrom) outputWhere.stockOutput.outputDate.gte = new Date(query.dateFrom);
        if (query.dateTo) outputWhere.stockOutput.outputDate.lte = new Date(query.dateTo);
      }

      if (query.responsibleName) {
        outputWhere.stockOutput.responsibleName = {
          contains: query.responsibleName,
          mode: 'insensitive',
        };
      }

      const outputItems = await (tx as any).stockOutputItem.findMany({
        where: outputWhere,
        include: {
          stockOutput: {
            select: {
              id: true,
              outputDate: true,
              type: true,
              responsibleName: true,
              notes: true,
            },
          },
        },
        orderBy: { stockOutput: { outputDate: 'desc' } },
      });

      for (const item of outputItems) {
        const type = item.stockOutput.type as StockOutputTypeValue;
        entries.push({
          id: item.id,
          date: item.stockOutput.outputDate.toISOString(),
          movementType: 'EXIT',
          type,
          typeLabel: STOCK_OUTPUT_TYPE_LABELS[type] || type,
          quantity: toNumber(item.quantity),
          unitCost: toNumber(item.unitCost),
          totalCost: toNumber(item.totalCost),
          batchNumber: item.batchNumber || null,
          referenceId: item.stockOutput.id,
          responsibleName: item.stockOutput.responsibleName || null,
          notes: item.stockOutput.notes || null,
        });
      }
    }

    // Sort all by date desc
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = entries.length;
    const paged = entries.slice((page - 1) * limit, page * limit);

    return {
      data: paged,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT MOVEMENTS CSV (CA10)
// ═══════════════════════════════════════════════════════════════════════

export async function exportMovementsCSV(
  ctx: RlsContext,
  query: ListMovementsQuery,
): Promise<string> {
  const result = await listMovementHistory(ctx, { ...query, page: 1, limit: 10000 });

  const header =
    'Data,Tipo Mov.,Tipo,Quantidade,Custo Unit.,Custo Total,Lote,Responsável,Observações';
  const rows = result.data.map((m) =>
    [
      new Date(m.date).toLocaleDateString('pt-BR'),
      m.movementType === 'ENTRY' ? 'Entrada' : 'Saída',
      m.typeLabel,
      m.quantity.toFixed(4),
      m.unitCost.toFixed(4),
      m.totalCost.toFixed(2),
      m.batchNumber || '',
      m.responsibleName || '',
      (m.notes || '').replace(/[,\n\r]/g, ' '),
    ].join(','),
  );

  return [header, ...rows].join('\n');
}
