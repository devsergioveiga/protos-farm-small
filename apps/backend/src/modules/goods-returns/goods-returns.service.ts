import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  GoodsReturnError,
  canGrReturnTransition,
  GR_RETURN_STATUS_LABELS,
  GR_RETURN_REASON_LABELS,
  GR_RETURN_ACTION_LABELS,
  GR_RETURN_RESOLUTION_STATUS_LABELS,
  type CreateGoodsReturnInput,
  type TransitionGrReturnInput,
  type ListGoodsReturnsQuery,
  type GoodsReturnOutput,
  type GoodsReturnListItem,
  type ListGoodsReturnsResult,
  type GrReturnStatus,
  type GrReturnReasonValue,
  type GrReturnActionValue,
  type GrReturnResolutionStatusValue,
} from './goods-returns.types';
import { createNotification } from '../notifications/notifications.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Sequential Numbering ────────────────────────────────────────────

async function getNextDevSequentialNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.goodsReturn.findFirst({
    where: {
      organizationId,
      sequentialNumber: { startsWith: `DEV-${year}/` },
    },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });

  let lastNum = 0;
  if (last?.sequentialNumber) {
    const parts = last.sequentialNumber.split('/');
    lastNum = parseInt(parts[1] ?? '0', 10);
  }

  return `DEV-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}

// ─── Formatters ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatItem(item: any) {
  return {
    id: item.id as string,
    goodsReturnId: item.goodsReturnId as string,
    productId: (item.productId as string) ?? null,
    productName: item.productName as string,
    unitName: item.unitName as string,
    returnQty: String(item.returnQty),
    unitPrice: String(item.unitPrice),
    totalPrice: String(item.totalPrice),
    batchNumber: (item.batchNumber as string) ?? null,
    photoUrl: (item.photoUrl as string) ?? null,
    photoFileName: (item.photoFileName as string) ?? null,
    createdAt: (item.createdAt as Date).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatGoodsReturn(gr: any): GoodsReturnOutput {
  return {
    id: gr.id as string,
    organizationId: gr.organizationId as string,
    sequentialNumber: gr.sequentialNumber as string,
    goodsReceiptId: gr.goodsReceiptId as string,
    supplierId: gr.supplierId as string,
    supplierName: gr.supplier?.name ?? (gr.supplierId as string),
    status: gr.status as GrReturnStatus,
    statusLabel: GR_RETURN_STATUS_LABELS[gr.status as GrReturnStatus],
    reason: gr.reason as GrReturnReasonValue,
    reasonLabel: GR_RETURN_REASON_LABELS[gr.reason as GrReturnReasonValue],
    expectedAction: gr.expectedAction as GrReturnActionValue,
    actionLabel: GR_RETURN_ACTION_LABELS[gr.expectedAction as GrReturnActionValue],
    resolutionStatus: gr.resolutionStatus as GrReturnResolutionStatusValue,
    resolutionStatusLabel:
      GR_RETURN_RESOLUTION_STATUS_LABELS[gr.resolutionStatus as GrReturnResolutionStatusValue],
    resolutionDeadline: gr.resolutionDeadline
      ? (gr.resolutionDeadline as Date).toISOString()
      : null,
    returnInvoiceNumber: (gr.returnInvoiceNumber as string) ?? null,
    returnInvoiceDate: gr.returnInvoiceDate ? (gr.returnInvoiceDate as Date).toISOString() : null,
    notes: (gr.notes as string) ?? null,
    stockOutputId: (gr.stockOutputId as string) ?? null,
    creditPayableId: (gr.creditPayableId as string) ?? null,
    createdBy: gr.createdBy as string,
    createdAt: (gr.createdAt as Date).toISOString(),
    updatedAt: (gr.updatedAt as Date).toISOString(),
    items: (gr.items ?? []).map(formatItem),
    goodsReceipt: {
      sequentialNumber: gr.goodsReceipt?.sequentialNumber ?? '',
      purchaseOrderId: gr.goodsReceipt?.purchaseOrderId ?? null,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatListItem(gr: any): GoodsReturnListItem {
  const items = gr.items ?? [];
  const totalValue = items.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, item: any) => sum + Number(item.totalPrice),
    0,
  );

  return {
    id: gr.id as string,
    sequentialNumber: gr.sequentialNumber as string,
    supplierName: gr.supplier?.name ?? (gr.supplierId as string),
    status: gr.status as GrReturnStatus,
    statusLabel: GR_RETURN_STATUS_LABELS[gr.status as GrReturnStatus],
    reason: gr.reason as GrReturnReasonValue,
    reasonLabel: GR_RETURN_REASON_LABELS[gr.reason as GrReturnReasonValue],
    expectedAction: gr.expectedAction as GrReturnActionValue,
    actionLabel: GR_RETURN_ACTION_LABELS[gr.expectedAction as GrReturnActionValue],
    totalValue: String(totalValue),
    itemCount: items.length as number,
    createdAt: (gr.createdAt as Date).toISOString(),
  };
}

const GR_FULL_INCLUDE = {
  supplier: { select: { id: true, name: true, tradeName: true } },
  goodsReceipt: { select: { sequentialNumber: true, purchaseOrderId: true } },
  items: true,
} as const;

// ─── Create Goods Return ─────────────────────────────────────────────

export async function createGoodsReturn(
  ctx: RlsContext & { userId: string },
  input: CreateGoodsReturnInput,
): Promise<GoodsReturnOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Validate GoodsReceipt exists and is CONFIRMADO
    const gr = await tx.goodsReceipt.findFirst({
      where: { id: input.goodsReceiptId, organizationId: ctx.organizationId, deletedAt: null },
      select: {
        id: true,
        status: true,
        supplierId: true,
        items: {
          select: { productId: true, productName: true, receivedQty: true, unitPrice: true },
        },
      },
    });

    if (!gr) {
      throw new GoodsReturnError('Recebimento nao encontrado', 404);
    }

    if (gr.status !== 'CONFIRMADO') {
      throw new GoodsReturnError('Apenas recebimentos confirmados podem ser devolvidos', 400);
    }

    // Validate return quantities against received quantities
    for (const returnItem of input.items) {
      if (returnItem.productId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const receivedItem = gr.items.find((i: any) => i.productId === returnItem.productId);
        if (receivedItem && returnItem.returnQty > Number(receivedItem.receivedQty)) {
          throw new GoodsReturnError('Quantidade de devolucao excede quantidade recebida', 400);
        }
      }
    }

    const sequentialNumber = await getNextDevSequentialNumber(tx, ctx.organizationId);

    const goodsReturn = await tx.goodsReturn.create({
      data: {
        organizationId: ctx.organizationId,
        sequentialNumber,
        goodsReceiptId: input.goodsReceiptId,
        supplierId: gr.supplierId,
        status: 'PENDENTE',
        reason: input.reason,
        expectedAction: input.expectedAction,
        resolutionDeadline: input.resolutionDeadline ? new Date(input.resolutionDeadline) : null,
        returnInvoiceNumber: input.returnInvoiceNumber ?? null,
        returnInvoiceDate: input.returnInvoiceDate ? new Date(input.returnInvoiceDate) : null,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId ?? null,
            productName: item.productName,
            unitName: item.unitName,
            returnQty: item.returnQty,
            unitPrice: item.unitPrice,
            totalPrice: item.returnQty * item.unitPrice,
            batchNumber: item.batchNumber ?? null,
          })),
        },
      },
      include: GR_FULL_INCLUDE,
    });

    // Notify OC buyer (needs to contact supplier about the return)
    const receipt = await tx.goodsReceipt.findFirst({
      where: { id: input.goodsReceiptId },
      select: {
        purchaseOrder: {
          select: { createdBy: true, sequentialNumber: true },
        },
      },
    });
    if (receipt?.purchaseOrder?.createdBy) {
      void createNotification(tx, ctx.organizationId, {
        recipientId: receipt.purchaseOrder.createdBy,
        type: 'RETURN_REGISTERED',
        title: 'Devolucao registrada',
        body: `Uma devolucao foi registrada para o pedido ${receipt.purchaseOrder.sequentialNumber}. Entre em contato com o fornecedor.`,
        referenceId: goodsReturn.id,
        referenceType: 'GOODS_RETURN',
      }).catch(() => {});
    }

    return formatGoodsReturn(goodsReturn);
  });
}

// ─── List Goods Returns ──────────────────────────────────────────────

export async function listGoodsReturns(
  ctx: RlsContext,
  query: ListGoodsReturnsQuery,
): Promise<ListGoodsReturnsResult> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };

  if (query.status) where.status = query.status;
  if (query.supplierId) where.supplierId = query.supplierId;

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }

  if (query.search) {
    where.OR = [
      { sequentialNumber: { contains: query.search, mode: 'insensitive' } },
      { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  return withRlsContext(ctx, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.goodsReturn.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          items: { select: { totalPrice: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      tx.goodsReturn.count({ where }),
    ]);

    return {
      data: rows.map(formatListItem),
      total,
      page,
      limit,
    };
  });
}

// ─── Get Goods Return by ID ──────────────────────────────────────────

export async function getGoodsReturn(ctx: RlsContext, id: string): Promise<GoodsReturnOutput> {
  return withRlsContext(ctx, async (tx) => {
    const gr = await tx.goodsReturn.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: GR_FULL_INCLUDE,
    });

    if (!gr) {
      throw new GoodsReturnError('Devolucao nao encontrada', 404);
    }

    return formatGoodsReturn(gr);
  });
}

// ─── Transition Goods Return ─────────────────────────────────────────

export async function transitionGoodsReturn(
  ctx: RlsContext & { userId: string },
  id: string,
  input: TransitionGrReturnInput,
): Promise<GoodsReturnOutput> {
  return withRlsContext(ctx, async (tx) => {
    const gr = await tx.goodsReturn.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        items: true,
        goodsReceipt: {
          select: {
            sequentialNumber: true,
            purchaseOrderId: true,
            payableId: true,
            supplierId: true,
            storageFarmId: true,
          },
        },
        supplier: { select: { id: true, name: true } },
      },
    });

    if (!gr) {
      throw new GoodsReturnError('Devolucao nao encontrada', 404);
    }

    if (!canGrReturnTransition(gr.status, input.status)) {
      throw new GoodsReturnError(`Transicao invalida de ${gr.status} para ${input.status}`, 400);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      status: input.status,
      notes: input.notes !== undefined ? input.notes : gr.notes,
    };

    if (input.status === 'APROVADA') {
      // Calculate total return value
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalReturnValue = gr.items.reduce((sum: number, item: any) => {
        return sum + Number(item.totalPrice);
      }, 0);

      // Step A: Create RETURN StockOutput for items that have productId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stockItems = gr.items.filter((item: any) => !!item.productId);

      if (stockItems.length > 0) {
        const stockOutput = await tx.stockOutput.create({
          data: {
            organizationId: ctx.organizationId,
            outputDate: new Date(),
            type: 'RETURN',
            status: 'CONFIRMED',
            notes: `Devolucao ${gr.sequentialNumber}`,
            totalCost: totalReturnValue,
            createdBy: ctx.userId,
            items: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              create: stockItems.map((item: any) => ({
                productId: item.productId as string,
                quantity: Number(item.returnQty),
                unitCost: Number(item.unitPrice),
                totalCost: Number(item.totalPrice),
                batchNumber: item.batchNumber ?? null,
              })),
            },
          },
          select: { id: true },
        });

        updateData.stockOutputId = stockOutput.id;

        // Reverse stock balance for returned items
        for (const item of stockItems) {
          const existing = await tx.stockBalance.findUnique({
            where: {
              organizationId_productId: {
                organizationId: ctx.organizationId,
                productId: item.productId as string,
              },
            },
          });

          if (existing) {
            const newQty = Math.max(0, Number(existing.currentQuantity) - Number(item.returnQty));
            const totalValue = newQty * Number(existing.averageCost);
            await tx.stockBalance.update({
              where: { id: existing.id },
              data: {
                currentQuantity: newQty,
                totalValue,
              },
            });
          }
        }
      }

      // Step B: Financial side effects based on expectedAction
      if (gr.expectedAction === 'CREDITO') {
        // Find the original payable via goodsReceipt.payableId
        const originalPayable = gr.goodsReceipt.payableId
          ? await tx.payable.findFirst({
              where: { id: gr.goodsReceipt.payableId, organizationId: ctx.organizationId },
              select: { id: true, farmId: true, supplierName: true, category: true },
            })
          : null;

        const farmId = originalPayable?.farmId ?? gr.goodsReceipt.storageFarmId ?? null;

        if (farmId) {
          const dueDate = new Date();
          const creditPayable = await tx.payable.create({
            data: {
              organizationId: ctx.organizationId,
              farmId,
              supplierName: gr.supplier?.name ?? '',
              category: originalPayable?.category ?? 'INPUTS',
              description: `Nota de credito - devolucao ${gr.sequentialNumber}`,
              totalAmount: -totalReturnValue,
              dueDate,
              installmentCount: 1,
              originType: 'GOODS_RETURN',
              originId: gr.id,
              goodsReturnId: gr.id,
              isCredit: true,
            },
            select: { id: true },
          });

          await tx.payableInstallment.createMany({
            data: [
              {
                payableId: creditPayable.id,
                number: 1,
                amount: -totalReturnValue,
                dueDate,
              },
            ],
          });

          updateData.creditPayableId = creditPayable.id;
        }
      } else if (gr.expectedAction === 'ESTORNO') {
        // Find and reduce original payable
        if (gr.goodsReceipt.payableId) {
          const originalPayable = await tx.payable.findFirst({
            where: { id: gr.goodsReceipt.payableId, organizationId: ctx.organizationId },
            include: {
              installments: {
                where: { status: 'PENDING' },
                orderBy: { number: 'asc' },
              },
            },
          });

          if (originalPayable) {
            const originalTotal = Number(originalPayable.totalAmount);
            const newTotal = Math.max(0, originalTotal - totalReturnValue);
            const isFullReturn = totalReturnValue >= originalTotal;

            if (isFullReturn) {
              // Cancel all pending installments and set payable to CANCELADA
              await tx.payable.update({
                where: { id: originalPayable.id },
                data: { status: 'CANCELLED', totalAmount: 0 },
              });

              await tx.payableInstallment.updateMany({
                where: { payableId: originalPayable.id, status: 'PENDING' },
                data: { status: 'CANCELLED' },
              });
            } else {
              // Reduce totalAmount and recalculate pending installments proportionally
              await tx.payable.update({
                where: { id: originalPayable.id },
                data: { totalAmount: newTotal },
              });

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pendingInstallments = originalPayable.installments as any[];
              if (pendingInstallments.length > 0) {
                const amountPerInstallment = newTotal / pendingInstallments.length;
                for (const installment of pendingInstallments) {
                  await tx.payableInstallment.update({
                    where: { id: installment.id },
                    data: { amount: amountPerInstallment },
                  });
                }
              }
            }
          }
        }
        // TROCA: no financial action needed
      }
    }

    if (input.status === 'CONCLUIDA') {
      updateData.resolutionStatus = 'RESOLVED';

      // Notify FINANCIAL users that return is resolved (fire-and-forget)
      const financialUsers = await tx.user.findMany({
        where: { organizationId: ctx.organizationId, role: 'FINANCIAL' },
        select: { id: true },
        take: 5,
      });
      for (const u of financialUsers) {
        void createNotification(tx, ctx.organizationId, {
          recipientId: u.id,
          type: 'RETURN_RESOLVED',
          title: 'Devolucao resolvida',
          body: `Devolucao ${gr.sequentialNumber} foi concluida e aguarda processamento financeiro.`,
          referenceId: gr.id,
          referenceType: 'GOODS_RETURN',
        }).catch(() => {});
      }
    }

    const updated = await tx.goodsReturn.update({
      where: { id },
      data: updateData,
      include: GR_FULL_INCLUDE,
    });

    return formatGoodsReturn(updated);
  });
}

// ─── Upload Return Photo ─────────────────────────────────────────────

export async function uploadReturnPhoto(
  ctx: RlsContext,
  returnId: string,
  itemId: string,
  file: Express.Multer.File,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const gr = await tx.goodsReturn.findFirst({
      where: { id: returnId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!gr) {
      throw new GoodsReturnError('Devolucao nao encontrada', 404);
    }

    const photoUrl = file.path;
    const photoFileName = file.originalname;

    await tx.goodsReturnItem.update({
      where: { id: itemId },
      data: { photoUrl, photoFileName },
    });
  });
}

// ─── Delete Goods Return ─────────────────────────────────────────────

export async function deleteGoodsReturn(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const gr = await tx.goodsReturn.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!gr) {
      throw new GoodsReturnError('Devolucao nao encontrada', 404);
    }

    if (gr.status !== 'PENDENTE') {
      throw new GoodsReturnError('Apenas devolu\u00e7oes pendentes podem ser excluidas', 400);
    }

    await tx.goodsReturn.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}
