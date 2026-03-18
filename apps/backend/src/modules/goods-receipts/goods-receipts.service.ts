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
