import { Money } from '@protos-farm/shared';
import { generateInstallments } from '@protos-farm/shared';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  GoodsReceiptError,
  canGrTransition,
  GR_STATUS_LABELS,
  RECEIVING_TYPE_LABELS,
  DIVERGENCE_TYPE_LABELS,
  DIVERGENCE_ACTION_LABELS,
  type CreateGoodsReceiptInput,
  type TransitionGrInput,
  type ListGoodsReceiptsQuery,
  type GoodsReceiptOutput,
  type GoodsReceiptListItem,
  type ListGoodsReceiptsResult,
  type PendingDelivery,
  type GrStatus,
  type ReceivingTypeValue,
  type DivergenceTypeValue,
  type DivergenceActionValue,
} from './goods-receipts.types';
import { canOcTransition } from '../purchase-orders/purchase-orders.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Sequential Numbering ────────────────────────────────────────────

async function getNextGrSequentialNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.goodsReceipt.findFirst({
    where: {
      organizationId,
      sequentialNumber: { startsWith: `REC-${year}/` },
    },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });

  let lastNum = 0;
  if (last?.sequentialNumber) {
    const parts = last.sequentialNumber.split('/');
    lastNum = parseInt(parts[1] ?? '0', 10);
  }

  return `REC-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}

// ─── Formatters ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDivergence(d: any) {
  return {
    id: d.id,
    itemId: d.itemId,
    divergenceType: d.divergenceType as DivergenceTypeValue,
    divergenceTypeLabel: DIVERGENCE_TYPE_LABELS[d.divergenceType as DivergenceTypeValue],
    action: d.action as DivergenceActionValue,
    actionLabel: DIVERGENCE_ACTION_LABELS[d.action as DivergenceActionValue],
    observation: d.observation ?? null,
    photoUrl: d.photoUrl ?? null,
    photoFileName: d.photoFileName ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatItem(item: any) {
  return {
    id: item.id,
    purchaseOrderItemId: item.purchaseOrderItemId ?? null,
    productId: item.productId ?? null,
    productName: item.productName,
    unitName: item.unitName,
    orderedQty: Number(item.orderedQty),
    invoiceQty: item.invoiceQty != null ? Number(item.invoiceQty) : null,
    receivedQty: Number(item.receivedQty),
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
    qualityVisualOk: item.qualityVisualOk ?? null,
    batchNumber: item.batchNumber ?? null,
    expirationDate: item.expirationDate ? item.expirationDate.toISOString() : null,
    qualityNotes: item.qualityNotes ?? null,
    hasDivergence: item.hasDivergence,
    divergencePct: item.divergencePct != null ? Number(item.divergencePct) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatGoodsReceipt(gr: any): GoodsReceiptOutput {
  return {
    id: gr.id,
    sequentialNumber: gr.sequentialNumber,
    status: gr.status as GrStatus,
    statusLabel: GR_STATUS_LABELS[gr.status as GrStatus],
    receivingType: gr.receivingType as ReceivingTypeValue,
    receivingTypeLabel: RECEIVING_TYPE_LABELS[gr.receivingType as ReceivingTypeValue],
    purchaseOrderId: gr.purchaseOrderId ?? null,
    purchaseOrder: gr.purchaseOrder
      ? { sequentialNumber: gr.purchaseOrder.sequentialNumber, status: gr.purchaseOrder.status }
      : null,
    supplierId: gr.supplierId,
    supplier: {
      id: gr.supplier.id,
      name: gr.supplier.name,
      tradeName: gr.supplier.tradeName ?? null,
    },
    invoiceNumber: gr.invoiceNumber ?? null,
    invoiceSerie: gr.invoiceSerie ?? null,
    invoiceCfop: gr.invoiceCfop ?? null,
    invoiceDate: gr.invoiceDate ? gr.invoiceDate.toISOString() : null,
    invoiceTotal: gr.invoiceTotal != null ? Number(gr.invoiceTotal) : null,
    invoiceKey: gr.invoiceKey ?? null,
    isProvisional: gr.isProvisional,
    stockEntryId: gr.stockEntryId ?? null,
    payableId: gr.payableId ?? null,
    storageFarmId: gr.storageFarmId ?? null,
    notes: gr.notes ?? null,
    emergencyJustification: gr.emergencyJustification ?? null,
    receivedAt: gr.receivedAt ? gr.receivedAt.toISOString() : null,
    conferredAt: gr.conferredAt ? gr.conferredAt.toISOString() : null,
    confirmedAt: gr.confirmedAt ? gr.confirmedAt.toISOString() : null,
    rejectedAt: gr.rejectedAt ? gr.rejectedAt.toISOString() : null,
    rejectionReason: gr.rejectionReason ?? null,
    createdBy: gr.createdBy,
    creator: { id: gr.creator.id, name: gr.creator.name },
    items: (gr.items ?? []).map(formatItem),
    divergences: (gr.divergences ?? []).map(formatDivergence),
    createdAt: gr.createdAt.toISOString(),
    updatedAt: gr.updatedAt.toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatGoodsReceiptListItem(gr: any): GoodsReceiptListItem {
  return {
    id: gr.id,
    sequentialNumber: gr.sequentialNumber,
    status: gr.status as GrStatus,
    statusLabel: GR_STATUS_LABELS[gr.status as GrStatus],
    receivingType: gr.receivingType as ReceivingTypeValue,
    receivingTypeLabel: RECEIVING_TYPE_LABELS[gr.receivingType as ReceivingTypeValue],
    invoiceNumber: gr.invoiceNumber ?? null,
    invoiceTotal: gr.invoiceTotal != null ? Number(gr.invoiceTotal) : null,
    isProvisional: gr.isProvisional,
    createdAt: gr.createdAt.toISOString(),
    supplier: {
      id: gr.supplier.id,
      name: gr.supplier.name,
      tradeName: gr.supplier.tradeName ?? null,
    },
    purchaseOrder: gr.purchaseOrder
      ? { sequentialNumber: gr.purchaseOrder.sequentialNumber }
      : null,
    _count: { items: gr._count?.items ?? 0, divergences: gr._count?.divergences ?? 0 },
  };
}

const GR_FULL_INCLUDE = {
  supplier: { select: { id: true, name: true, tradeName: true } },
  purchaseOrder: { select: { sequentialNumber: true, status: true } },
  creator: { select: { id: true, name: true } },
  items: true,
  divergences: true,
} as const;

// ─── Create Goods Receipt ────────────────────────────────────────────

export async function createGoodsReceipt(
  ctx: RlsContext & { userId: string },
  input: CreateGoodsReceiptInput,
): Promise<GoodsReceiptOutput> {
  // Validate EMERGENCIAL rules
  if (input.receivingType === 'EMERGENCIAL') {
    if (!input.emergencyJustification || input.emergencyJustification.trim() === '') {
      throw new GoodsReceiptError('Justificativa e obrigatoria para recebimento emergencial', 400);
    }
    if (input.purchaseOrderId) {
      throw new GoodsReceiptError(
        'Recebimento emergencial nao pode estar vinculado a um pedido de compra',
        400,
      );
    }
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate PO if provided
    if (input.purchaseOrderId) {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: input.purchaseOrderId, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true, status: true },
      });

      if (!po) {
        throw new GoodsReceiptError('Pedido de compra nao encontrado', 404);
      }

      if (!['CONFIRMADA', 'EM_TRANSITO'].includes(po.status)) {
        throw new GoodsReceiptError(
          'Pedido de compra deve estar CONFIRMADA ou EM_TRANSITO para recebimento',
          400,
        );
      }
    }

    const sequentialNumber = await getNextGrSequentialNumber(tx, ctx.organizationId);
    const isProvisional = input.receivingType === 'NF_ANTECIPADA';

    const gr = await tx.goodsReceipt.create({
      data: {
        organizationId: ctx.organizationId,
        supplierId: input.supplierId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        sequentialNumber,
        status: 'PENDENTE',
        receivingType: input.receivingType,
        invoiceNumber: input.invoiceNumber ?? null,
        invoiceSerie: input.invoiceSerie ?? null,
        invoiceCfop: input.invoiceCfop ?? null,
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null,
        invoiceTotal: input.invoiceTotal ?? null,
        invoiceKey: input.invoiceKey ?? null,
        isProvisional,
        storageFarmId: input.storageFarmId ?? null,
        notes: input.notes ?? null,
        emergencyJustification: input.emergencyJustification ?? null,
        createdBy: ctx.userId,
        items: {
          create: input.items.map((item) => {
            const receivedQty = item.receivedQty;
            const orderedQty = item.orderedQty;
            const totalPrice = receivedQty * item.unitPrice;
            let divergencePct: number | null = null;
            let hasDivergence = false;
            if (orderedQty > 0) {
              divergencePct = Math.abs(receivedQty - orderedQty) / orderedQty;
              hasDivergence = divergencePct > 0.05;
            }
            return {
              purchaseOrderItemId: item.purchaseOrderItemId ?? null,
              productId: item.productId ?? null,
              productName: item.productName,
              unitName: item.unitName,
              orderedQty,
              invoiceQty: item.invoiceQty ?? null,
              receivedQty,
              unitPrice: item.unitPrice,
              totalPrice,
              qualityVisualOk: item.qualityVisualOk ?? null,
              batchNumber: item.batchNumber ?? null,
              expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
              qualityNotes: item.qualityNotes ?? null,
              hasDivergence,
              divergencePct,
            };
          }),
        },
        divergences: input.divergences
          ? {
              create: input.divergences.map((div) => ({
                itemId: div.itemId,
                divergenceType: div.divergenceType,
                action: div.action,
                observation: div.observation ?? null,
              })),
            }
          : undefined,
      },
      include: GR_FULL_INCLUDE,
    });

    return formatGoodsReceipt(gr);
  });
}

// ─── List Goods Receipts ─────────────────────────────────────────────

export async function listGoodsReceipts(
  ctx: RlsContext,
  query: ListGoodsReceiptsQuery,
): Promise<ListGoodsReceiptsResult> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };

  if (query.status) where.status = query.status;
  if (query.receivingType) where.receivingType = query.receivingType;
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.purchaseOrderId) where.purchaseOrderId = query.purchaseOrderId;

  if (query.search) {
    where.OR = [
      { sequentialNumber: { contains: query.search, mode: 'insensitive' } },
      { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  return withRlsContext(ctx, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.goodsReceipt.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, tradeName: true } },
          purchaseOrder: { select: { sequentialNumber: true } },
          _count: { select: { items: true, divergences: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      tx.goodsReceipt.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: rows.map(formatGoodsReceiptListItem),
      total,
      page,
      limit,
      totalPages,
    };
  });
}

// ─── Get Goods Receipt by ID ─────────────────────────────────────────

export async function getGoodsReceiptById(
  ctx: RlsContext,
  id: string,
): Promise<GoodsReceiptOutput> {
  return withRlsContext(ctx, async (tx) => {
    const gr = await tx.goodsReceipt.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: GR_FULL_INCLUDE,
    });

    if (!gr) {
      throw new GoodsReceiptError('Recebimento nao encontrado', 404);
    }

    return formatGoodsReceipt(gr);
  });
}

// ─── Transition Goods Receipt ────────────────────────────────────────

export async function transitionGoodsReceipt(
  ctx: RlsContext & { userId: string },
  id: string,
  input: TransitionGrInput,
): Promise<GoodsReceiptOutput> {
  return withRlsContext(ctx, async (tx) => {
    const gr = await tx.goodsReceipt.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!gr) {
      throw new GoodsReceiptError('Recebimento nao encontrado', 404);
    }

    if (!canGrTransition(gr.status, input.status)) {
      throw new GoodsReceiptError(`Transicao invalida: ${gr.status} -> ${input.status}`, 400);
    }

    // NOTE: CONFIRMADO transition is NOT handled here — Plan 03 adds confirmGoodsReceipt
    if (input.status === 'CONFIRMADO') {
      throw new GoodsReceiptError(
        'Transicao para CONFIRMADO deve ser feita via endpoint de confirmacao',
        400,
      );
    }

    if (
      input.status === 'REJEITADO' &&
      (!input.rejectionReason || input.rejectionReason.trim() === '')
    ) {
      throw new GoodsReceiptError('Motivo de rejeicao e obrigatorio', 400);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { status: input.status };

    if (input.status === 'EM_CONFERENCIA') {
      data.receivedAt = new Date();
    } else if (input.status === 'CONFERIDO') {
      data.conferredAt = new Date();
    } else if (input.status === 'REJEITADO') {
      data.rejectionReason = input.rejectionReason;
      data.rejectedAt = new Date();
    }

    const updated = await tx.goodsReceipt.update({
      where: { id },
      data,
      include: GR_FULL_INCLUDE,
    });

    return formatGoodsReceipt(updated);
  });
}

// ─── List Pending Deliveries ─────────────────────────────────────────

export async function listPendingDeliveries(ctx: RlsContext): Promise<PendingDelivery[]> {
  return withRlsContext(ctx, async (tx) => {
    const now = new Date();

    const pendingPOs = await tx.purchaseOrder.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ['CONFIRMADA', 'EM_TRANSITO'] },
        deletedAt: null,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { select: { id: true, quantity: true, receivedQuantity: true } },
      },
    });

    const result: PendingDelivery[] = [];

    for (const po of pendingPOs) {
      const itemCount = po.items.length;
      const totalPendingItems = po.items.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => Number(item.receivedQuantity ?? 0) < Number(item.quantity),
      ).length;

      // Only include POs with pending items
      if (totalPendingItems === 0) continue;

      const isOverdue = po.expectedDeliveryDate ? po.expectedDeliveryDate < now : false;

      result.push({
        purchaseOrderId: po.id,
        sequentialNumber: po.sequentialNumber,
        supplier: { id: po.supplier.id, name: po.supplier.name },
        expectedDeliveryDate: po.expectedDeliveryDate
          ? po.expectedDeliveryDate.toISOString()
          : null,
        isOverdue,
        itemCount,
        totalPendingItems,
      });
    }

    return result;
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Parse paymentTerms string (e.g. "30/60/90" or "A vista") into installmentCount and firstDueDays.
 * Returns { installmentCount, firstDueDays } where firstDueDays is days until first due date.
 */
function parsePaymentTerms(paymentTerms: string | null | undefined): {
  installmentCount: number;
  firstDueDays: number;
} {
  if (!paymentTerms || paymentTerms.trim().toLowerCase() === 'a vista') {
    return { installmentCount: 1, firstDueDays: 30 };
  }

  // Try parsing "30/60/90" style terms
  const parts = paymentTerms.split('/').map((p) => parseInt(p.trim(), 10));
  if (parts.length > 0 && parts.every((p) => !isNaN(p) && p >= 0)) {
    return {
      installmentCount: parts.length,
      firstDueDays: parts[0] || 30,
    };
  }

  // Fallback
  return { installmentCount: 1, firstDueDays: 30 };
}

// ─── confirmGoodsReceipt ─────────────────────────────────────────────

export async function confirmGoodsReceipt(
  ctx: RlsContext & { userId: string },
  id: string,
): Promise<GoodsReceiptOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Step 1 — Load and validate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gr = await (tx as any).goodsReceipt.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        ...GR_FULL_INCLUDE,
        supplier: { select: { id: true, name: true, tradeName: true } },
        purchaseOrder: {
          select: {
            sequentialNumber: true,
            status: true,
            quotationId: true,
            quotation: {
              select: {
                purchaseRequestId: true,
                purchaseRequest: {
                  select: { farmId: true, costCenterId: true },
                },
                suppliers: {
                  where: { isSelected: true },
                  include: {
                    proposal: { select: { paymentTerms: true } },
                  },
                  take: 1,
                },
              },
            },
            items: {
              select: {
                id: true,
                quantity: true,
                receivedQuantity: true,
              },
            },
          },
        },
        items: true,
        divergences: true,
      },
    });

    if (!gr) {
      throw new GoodsReceiptError('Recebimento nao encontrado', 404);
    }

    if (!canGrTransition(gr.status, 'CONFIRMADO')) {
      throw new GoodsReceiptError(
        `Transicao invalida: ${gr.status} -> CONFIRMADO. Recebimento deve estar CONFERIDO.`,
        400,
      );
    }

    // Require invoiceNumber for types that must have NF
    const requiresInvoice = ['STANDARD', 'PARCIAL', 'NF_FRACIONADA'].includes(gr.receivingType);
    if (requiresInvoice && (!gr.invoiceNumber || !gr.invoiceTotal)) {
      throw new GoodsReceiptError(
        'Numero e total da nota fiscal sao obrigatorios para confirmacao',
        400,
      );
    }

    // NF_ANTECIPADA: goods must have arrived (receivedAt set)
    if (gr.receivingType === 'NF_ANTECIPADA' && !gr.receivedAt) {
      throw new GoodsReceiptError(
        'Mercadoria deve ter sido recebida antes de confirmar NF antecipada',
        400,
      );
    }

    // Step 2 — Derive farmId and costCenter
    let farmId: string | null = null;
    let costCenterId: string | null = null;

    if (gr.purchaseOrder?.quotation?.purchaseRequest) {
      farmId = gr.purchaseOrder.quotation.purchaseRequest.farmId ?? null;
      costCenterId = gr.purchaseOrder.quotation.purchaseRequest.costCenterId ?? null;
    }

    // Fallback to storageFarmId if no farmId from PO chain
    if (!farmId) {
      farmId = gr.storageFarmId ?? null;
    }

    // EMERGENCIAL (no PO): storageFarmId is required
    if (gr.receivingType === 'EMERGENCIAL' && !farmId) {
      throw new GoodsReceiptError(
        'Fazenda de armazenamento e obrigatoria para recebimento emergencial',
        400,
      );
    }

    // If still no farmId, we can't create a payable — but we can still proceed without it
    // (Some scenarios may not need a payable, e.g., MERCADORIA_ANTECIPADA)
    const canCreatePayable = farmId !== null && gr.receivingType !== 'MERCADORIA_ANTECIPADA';

    // Step 3 — Build StockEntry using tx directly (avoid nested withRlsContext)
    const isAnticipatedGoods = gr.receivingType === 'MERCADORIA_ANTECIPADA';
    const stockEntryStatus = isAnticipatedGoods ? 'DRAFT' : 'CONFIRMED';

    // Map GR items to stock entry items, skipping items without productId

    const stockItems = gr.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => !!item.productId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ({
        productId: item.productId as string,
        quantity: Number(item.receivedQty),
        unitCost: Number(item.unitPrice),
        batchNumber: item.batchNumber ?? null,
        expirationDate: item.expirationDate ? (item.expirationDate as Date).toISOString() : null,
      }));

    // Only create stock entry if there are items with productId
    let stockEntryId: string | null = null;

    if (stockItems.length > 0) {
      const entryDate = gr.invoiceDate ?? new Date();
      const totalMerchandiseCost = stockItems.reduce(
        (sum: number, item: { quantity: number; unitCost: number }) =>
          sum + item.quantity * item.unitCost,
        0,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stockEntry = await (tx as any).stockEntry.create({
        data: {
          organizationId: ctx.organizationId,
          entryDate,
          status: stockEntryStatus,
          supplierName: gr.supplier.name,
          invoiceNumber: gr.invoiceNumber ?? null,
          storageFarmId: gr.storageFarmId ?? null,
          totalMerchandiseCost,
          totalExpensesCost: 0,
          totalCost: totalMerchandiseCost,
          createdBy: ctx.userId,
          goodsReceiptId: gr.id,
          items: {
            create: stockItems.map(
              (item: {
                productId: string;
                quantity: number;
                unitCost: number;
                batchNumber: string | null;
                expirationDate: string | null;
              }) => {
                const totalCost = item.quantity * item.unitCost;
                return {
                  productId: item.productId,
                  quantity: item.quantity,
                  unitCost: item.unitCost,
                  totalCost,
                  apportionedExpenses: 0,
                  finalUnitCost: item.unitCost,
                  finalTotalCost: totalCost,
                  batchNumber: item.batchNumber,
                  expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
                };
              },
            ),
          },
        },
        select: { id: true },
      });

      stockEntryId = stockEntry.id as string;

      // Update stock balances for CONFIRMED entries
      if (stockEntryStatus === 'CONFIRMED') {
        for (const item of stockItems) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existing = await (tx as any).stockBalance.findUnique({
            where: {
              organizationId_productId: {
                organizationId: ctx.organizationId,
                productId: item.productId,
              },
            },
          });

          const finalTotalCost = item.quantity * item.unitCost;

          if (existing) {
            const prevQty = Number(existing.currentQuantity);
            const prevAvg = Number(existing.averageCost);
            const prevTotal = prevQty * prevAvg;
            const newTotal = prevTotal + finalTotalCost;
            const newQty = prevQty + item.quantity;
            const newAvgCost = newQty > 0 ? newTotal / newQty : 0;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            const avgCost = item.quantity > 0 ? finalTotalCost / item.quantity : 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any).stockBalance.create({
              data: {
                organizationId: ctx.organizationId,
                productId: item.productId,
                currentQuantity: item.quantity,
                averageCost: avgCost,
                totalValue: finalTotalCost,
                lastEntryDate: entryDate,
              },
            });
          }
        }
      }
    }

    // Step 4 — Build Payable using tx directly
    let payableId: string | null = null;

    if (canCreatePayable && gr.invoiceTotal && farmId) {
      // Get payment terms from the QuotationProposal for this supplier
      const selectedSupplier = gr.purchaseOrder?.quotation?.suppliers?.[0];
      const paymentTerms = selectedSupplier?.proposal?.paymentTerms ?? null;
      const { installmentCount, firstDueDays } = parsePaymentTerms(paymentTerms);

      const invoiceDate = gr.invoiceDate ?? new Date();
      const firstDueDate = new Date(invoiceDate.getTime() + firstDueDays * 24 * 60 * 60 * 1000);
      const totalAmount = Number(gr.invoiceTotal);
      const totalMoney = Money(totalAmount);

      const installments = generateInstallments(totalMoney, installmentCount, firstDueDate);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payable = await (tx as any).payable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId,
          supplierName: gr.supplier.name,
          category: 'INPUTS',
          description: `NF ${gr.invoiceNumber ?? 'S/N'} - ${gr.sequentialNumber}`,
          totalAmount: totalMoney.toDecimal(),
          dueDate: firstDueDate,
          documentNumber: gr.invoiceNumber ?? null,
          installmentCount,
          originType: 'GOODS_RECEIPT',
          originId: gr.id,
          goodsReceiptId: gr.id,
        },
        select: { id: true },
      });

      payableId = payable.id as string;

      // Create installments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).payableInstallment.createMany({
        data: installments.map((inst) => ({
          payableId: payableId!,
          number: inst.number,
          amount: inst.amount.toDecimal(),
          dueDate: inst.dueDate,
        })),
      });

      // Create cost center item
      if (costCenterId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any).payableCostCenterItem.create({
          data: {
            payableId: payableId,
            costCenterId,
            farmId,
            allocMode: 'PERCENTAGE',
            percentage: 100,
          },
        });
      }
    }

    // Step 5 — Update PO receivedQuantity (partial delivery tracking)
    if (gr.purchaseOrderId && gr.purchaseOrder) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const grItem of gr.items as any[]) {
        if (grItem.purchaseOrderItemId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (tx as any).purchaseOrderItem.update({
            where: { id: grItem.purchaseOrderItemId },
            data: { receivedQuantity: { increment: Number(grItem.receivedQty) } },
          });
        }
      }

      // Reload PO items and check if fully received
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedPoItems = await (tx as any).purchaseOrderItem.findMany({
        where: { purchaseOrderId: gr.purchaseOrderId },
        select: { quantity: true, receivedQuantity: true },
      });

      const fullyReceived =
        updatedPoItems.length > 0 &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedPoItems.every((item: any) => Number(item.receivedQuantity) >= Number(item.quantity));

      if (fullyReceived && canOcTransition(gr.purchaseOrder.status, 'ENTREGUE')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any).purchaseOrder.update({
          where: { id: gr.purchaseOrderId },
          data: { status: 'ENTREGUE' },
        });
      }
    }

    // Step 6 — Update GR record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (tx as any).goodsReceipt.update({
      where: { id },
      data: {
        status: 'CONFIRMADO',
        confirmedAt: new Date(),
        stockEntryId: stockEntryId ?? null,
        payableId: payableId ?? null,
      },
      include: GR_FULL_INCLUDE,
    });

    return formatGoodsReceipt(updated);
  });
}

// ─── Update Divergence Photo ─────────────────────────────────────────

export async function updateGoodsReceiptDivergencePhoto(
  ctx: RlsContext,
  goodsReceiptId: string,
  divergenceId: string,
  photoUrl: string,
  photoFileName: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    // Verify GR belongs to org
    const gr = await tx.goodsReceipt.findFirst({
      where: { id: goodsReceiptId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!gr) {
      throw new GoodsReceiptError('Recebimento nao encontrado', 404);
    }

    await tx.goodsReceiptDivergence.update({
      where: { id: divergenceId },
      data: { photoUrl, photoFileName },
    });
  });
}
