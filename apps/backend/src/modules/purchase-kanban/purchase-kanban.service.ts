import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  ALLOWED_TRANSITIONS,
  PurchaseKanbanError,
  type KanbanCard,
  type KanbanColumn,
  type KanbanFilters,
} from './purchase-kanban.types';
import { transitionPurchaseRequest } from '../purchase-requests/purchase-requests.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Column Assignment ────────────────────────────────────────────────

function assignColumnFromRc(rc: TxClient): KanbanColumn {
  // Walk from deepest entity to shallowest
  const latestQuotation = rc.quotations?.[0];
  const latestPo = latestQuotation?.purchaseOrders?.[0];
  const latestGr = latestPo?.goodsReceipts?.[0];

  if (latestGr) {
    if (latestGr.status === 'CONFIRMADO') {
      // Check if payable is fully paid
      if (latestGr.payableId && latestGr.payable) {
        const allPaid = latestGr.payable.installments?.every(
          (inst: TxClient) => inst.status === 'PAID',
        );
        if (allPaid) return 'PAGO';
      }
      return 'RECEBIDO';
    }
    // GR exists but not confirmed -> awaiting delivery (PO was issued)
    return 'AGUARDANDO_ENTREGA';
  }

  if (latestPo) {
    if (['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO'].includes(latestPo.status)) {
      return 'AGUARDANDO_ENTREGA';
    }
    // PO in RASCUNHO or just created
    return 'OC_EMITIDA';
  }

  if (latestQuotation) {
    return 'EM_COTACAO';
  }

  if (rc.status === 'APROVADA') {
    return 'APROVADA';
  }

  // PENDENTE, EM_ANALISE
  return 'RC_PENDENTE';
}

function assignColumnFromEmergencyPo(po: TxClient): KanbanColumn {
  const latestGr = po.goodsReceipts?.[0];

  if (latestGr) {
    if (latestGr.status === 'CONFIRMADO') {
      if (latestGr.payableId && latestGr.payable) {
        const allPaid = latestGr.payable.installments?.every(
          (inst: TxClient) => inst.status === 'PAID',
        );
        if (allPaid) return 'PAGO';
      }
      return 'RECEBIDO';
    }
    return 'AGUARDANDO_ENTREGA';
  }

  if (['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO'].includes(po.status)) {
    return 'AGUARDANDO_ENTREGA';
  }

  return 'OC_EMITIDA';
}

function computeDaysInStage(entity: TxClient): number {
  const updatedAt = entity?.updatedAt ?? entity?.createdAt;
  if (!updatedAt) return 0;
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function computeIsOverdue(rc: TxClient | null, po: TxClient | null): boolean {
  const now = new Date();

  if (po?.expectedDeliveryDate) {
    return new Date(po.expectedDeliveryDate) < now;
  }

  if (rc?.slaDeadline) {
    return new Date(rc.slaDeadline) < now;
  }

  return false;
}

function mapRcToCard(rc: TxClient): KanbanCard {
  const column = assignColumnFromRc(rc);
  const latestQuotation = rc.quotations?.[0];
  const latestPo = latestQuotation?.purchaseOrders?.[0];
  const latestGr = latestPo?.goodsReceipts?.[0];

  // Determine deepest entity for daysInStage
  const stageEntity = latestGr ?? latestPo ?? latestQuotation ?? rc;

  const totalValue = rc.items.reduce(
    (sum: number, item: TxClient) =>
      sum + Number(item.estimatedUnitPrice ?? 0) * Number(item.quantity ?? 1),
    0,
  );

  const poTotalValue = latestPo
    ? (latestPo.items ?? []).reduce(
        (sum: number, item: TxClient) => sum + Number(item.totalPrice ?? 0),
        0,
      )
    : null;

  return {
    id: rc.id,
    column,
    number: rc.sequentialNumber ?? rc.id,
    type: rc.requestType ?? '',
    requester: rc.createdByUser?.name ?? '',
    totalValue: poTotalValue ?? totalValue,
    urgency: rc.urgency ?? 'NORMAL',
    daysInStage: computeDaysInStage(stageEntity),
    isOverdue: computeIsOverdue(rc, latestPo ?? null),
    purchaseRequestId: rc.id,
    quotationId: latestQuotation?.id ?? null,
    purchaseOrderId: latestPo?.id ?? null,
    goodsReceiptId: latestGr?.id ?? null,
    payableId: latestGr?.payableId ?? null,
    isEmergency: false,
  };
}

function mapEmergencyPoToCard(po: TxClient): KanbanCard {
  const column = assignColumnFromEmergencyPo(po);
  const latestGr = po.goodsReceipts?.[0];

  const totalValue = (po.items ?? []).reduce(
    (sum: number, item: TxClient) => sum + Number(item.totalPrice ?? 0),
    0,
  );

  return {
    id: po.id,
    column,
    number: po.sequentialNumber ?? po.id,
    type: 'EMERGENCIAL',
    requester: po.creator?.name ?? po.createdByUser?.name ?? '',
    totalValue,
    urgency: 'EMERGENCIAL',
    daysInStage: computeDaysInStage(latestGr ?? po),
    isOverdue: computeIsOverdue(null, po),
    purchaseRequestId: null,
    quotationId: null,
    purchaseOrderId: po.id,
    goodsReceiptId: latestGr?.id ?? null,
    payableId: latestGr?.payableId ?? null,
    isEmergency: true,
  };
}

// ─── getKanbanCards ───────────────────────────────────────────────────

export async function getKanbanCards(
  ctx: RlsContext,
  filters: KanbanFilters,
): Promise<KanbanCard[]> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rcWhere: Record<string, any> = {
      organizationId: ctx.organizationId,
      status: { notIn: ['RASCUNHO', 'CANCELADA', 'REJEITADA'] },
      deletedAt: null,
    };

    if (filters.farmId) {
      rcWhere.farmId = filters.farmId;
    }
    if (filters.urgency) {
      rcWhere.urgency = filters.urgency;
    }
    if (filters.category) {
      rcWhere.requestType = filters.category;
    }
    if (filters.startDate || filters.endDate) {
      rcWhere.createdAt = {};
      if (filters.startDate) rcWhere.createdAt.gte = filters.startDate;
      if (filters.endDate) rcWhere.createdAt.lte = filters.endDate;
    }

    // Query 1: All active PurchaseRequests with pipeline
    const purchaseRequests = await tx.purchaseRequest.findMany({
      where: rcWhere,
      include: {
        quotations: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            purchaseOrders: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                goodsReceipts: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  include: {
                    payable: {
                      include: {
                        installments: { select: { status: true } },
                      },
                    },
                  },
                },
                items: { select: { totalPrice: true } },
              },
            },
          },
        },
        items: {
          select: { estimatedUnitPrice: true, quantity: true },
        },
        createdByUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const poWhere: Record<string, any> = {
      organizationId: ctx.organizationId,
      isEmergency: true,
      quotationId: null,
      deletedAt: null,
      status: { not: 'CANCELADA' },
    };

    if (filters.supplierId) {
      poWhere.supplierId = filters.supplierId;
    }

    // Query 2: Emergency POs without a quotation (bypass RC)
    const emergencyPos = await tx.purchaseOrder.findMany({
      where: poWhere,
      include: {
        goodsReceipts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            payable: {
              include: {
                installments: { select: { status: true } },
              },
            },
          },
        },
        items: { select: { totalPrice: true } },
        creator: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rcCards = purchaseRequests.map(mapRcToCard);
    const emergencyCards = emergencyPos.map(mapEmergencyPoToCard);

    return [...rcCards, ...emergencyCards];
  });
}

// ─── transitionCard ───────────────────────────────────────────────────

export async function transitionCard(
  ctx: RlsContext & { userId: string },
  cardId: string,
  targetColumn: KanbanColumn,
): Promise<void> {
  // Get current cards to determine the current column
  const cards = await getKanbanCards(ctx, {});
  const card = cards.find((c) => c.id === cardId);

  if (!card) {
    throw new PurchaseKanbanError('Card nao encontrado', 404);
  }

  const currentColumn = card.column;
  const allowedTargets = ALLOWED_TRANSITIONS[currentColumn];

  if (!allowedTargets.includes(targetColumn)) {
    throw new PurchaseKanbanError(
      `Transicao nao permitida de ${currentColumn} para ${targetColumn}`,
      403,
    );
  }

  // Dispatch domain action based on targetColumn
  switch (targetColumn) {
    case 'APROVADA':
      // Only RC_PENDENTE -> APROVADA is a direct kanban action
      if (!card.purchaseRequestId) {
        throw new PurchaseKanbanError('Card de emergencia nao pode ser aprovado via kanban', 400);
      }
      await transitionPurchaseRequest(ctx, card.purchaseRequestId, { action: 'APPROVE' });
      break;

    case 'EM_COTACAO':
      throw new PurchaseKanbanError('Use a pagina de cotacoes para criar uma cotacao', 400);

    case 'OC_EMITIDA':
      throw new PurchaseKanbanError('Use a pagina de cotacoes para aprovar e gerar pedido', 400);

    case 'AGUARDANDO_ENTREGA':
      throw new PurchaseKanbanError('Use a pagina de pedidos para confirmar envio', 400);

    case 'RECEBIDO':
      throw new PurchaseKanbanError('Use a pagina de recebimentos para confirmar', 400);

    case 'PAGO':
      throw new PurchaseKanbanError('Use o contas a pagar para registrar pagamento', 400);

    default:
      throw new PurchaseKanbanError(`Coluna desconhecida: ${targetColumn}`, 400);
  }
}
