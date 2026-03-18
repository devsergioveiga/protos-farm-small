import { withRlsContext, type RlsContext } from '../../database/rls';
import type { KanbanBoard, KanbanCard, KanbanFilters } from './purchasing-kanban.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

const MS_PER_DAY = 86_400_000;

function daysInStage(updatedAt: Date): number {
  return Math.floor((Date.now() - updatedAt.getTime()) / MS_PER_DAY);
}

// ─── RC (Purchase Request) Cards ─────────────────────────────────────────────

async function getPurchaseRequestCards(
  tx: TxClient,
  organizationId: string,
  filters: KanbanFilters,
): Promise<{ pending: KanbanCard[]; approved: KanbanCard[] }> {
  const where: Record<string, unknown> = {
    organizationId,
    deletedAt: null,
  };
  if (filters.farmId) where.farmId = filters.farmId;
  if (filters.urgency) where.urgency = filters.urgency;
  if (filters.search) {
    where.sequentialNumber = { contains: filters.search, mode: 'insensitive' };
  }

  const rcs = await tx.purchaseRequest.findMany({
    where: {
      ...where,
      status: { in: ['RASCUNHO', 'PENDENTE', 'DEVOLVIDA', 'APROVADA'] },
    },
    select: {
      id: true,
      sequentialNumber: true,
      urgency: true,
      status: true,
      updatedAt: true,
      slaDeadline: true,
      farmId: true,
      farm: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      items: { select: { estimatedUnitPrice: true, quantity: true } },
      quotations: {
        where: { deletedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  });

  const pending: KanbanCard[] = [];
  const approved: KanbanCard[] = [];

  for (const rc of rcs) {
    const totalValue = rc.items.reduce(
      (
        sum: number,
        item: {
          estimatedUnitPrice: { toNumber: () => number } | null;
          quantity: { toNumber: () => number };
        },
      ) => {
        const price = item.estimatedUnitPrice ? Number(item.estimatedUnitPrice) : 0;
        const qty = item.quantity ? Number(item.quantity) : 0;
        return sum + price * qty;
      },
      0,
    );

    const days = daysInStage(rc.updatedAt);
    let overdue = false;
    if (rc.slaDeadline) {
      overdue = new Date(rc.slaDeadline) < new Date();
    } else {
      overdue = days > 7;
    }

    const card: KanbanCard = {
      id: rc.id,
      entityType: 'RC',
      sequentialNumber: rc.sequentialNumber,
      urgency: rc.urgency as 'NORMAL' | 'URGENTE' | 'EMERGENCIAL',
      requesterName: rc.creator?.name ?? 'Desconhecido',
      totalValue,
      daysInStage: days,
      isOverdue: overdue,
      farmId: rc.farm?.id ?? rc.farmId,
      farmName: rc.farm?.name ?? '',
    };

    if (rc.status === 'APROVADA' && rc.quotations.length === 0) {
      // Approved but no quotation yet → RC_APROVADA column
      approved.push(card);
    } else if (['RASCUNHO', 'PENDENTE', 'DEVOLVIDA'].includes(rc.status)) {
      pending.push(card);
    }
    // If APROVADA with quotation, it belongs to EM_COTACAO (handled by quotation cards)
  }

  return { pending, approved };
}

// ─── Quotation (SC) Cards ─────────────────────────────────────────────────────

async function getQuotationCards(
  tx: TxClient,
  organizationId: string,
  filters: KanbanFilters,
): Promise<KanbanCard[]> {
  const rcWhere: Record<string, unknown> = { organizationId, deletedAt: null };
  if (filters.farmId) rcWhere.farmId = filters.farmId;
  if (filters.urgency) rcWhere.urgency = filters.urgency;

  const where: Record<string, unknown> = {
    organizationId,
    deletedAt: null,
    status: { in: ['AGUARDANDO_PROPOSTA', 'EM_ANALISE'] },
    purchaseRequest: rcWhere,
  };
  if (filters.search) {
    where.sequentialNumber = { contains: filters.search, mode: 'insensitive' };
  }

  const quotations = await tx.quotation.findMany({
    where,
    select: {
      id: true,
      sequentialNumber: true,
      updatedAt: true,
      responseDeadline: true,
      purchaseRequest: {
        select: {
          id: true,
          urgency: true,
          farmId: true,
          farm: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          items: { select: { estimatedUnitPrice: true, quantity: true } },
        },
      },
    },
  });

  return quotations.map(
    (q: {
      id: string;
      sequentialNumber: string;
      updatedAt: Date;
      responseDeadline: Date | null;
      purchaseRequest: {
        id: string;
        urgency: string;
        farmId: string;
        farm: { id: string; name: string } | null;
        creator: { id: string; name: string } | null;
        items: {
          estimatedUnitPrice: { toNumber: () => number } | null;
          quantity: { toNumber: () => number };
        }[];
      };
    }) => {
      const rc = q.purchaseRequest;
      const totalValue = rc.items.reduce(
        (
          sum: number,
          item: {
            estimatedUnitPrice: { toNumber: () => number } | null;
            quantity: { toNumber: () => number };
          },
        ) => {
          const price = item.estimatedUnitPrice ? Number(item.estimatedUnitPrice) : 0;
          const qty = item.quantity ? Number(item.quantity) : 0;
          return sum + price * qty;
        },
        0,
      );

      const days = daysInStage(q.updatedAt);
      const overdue = q.responseDeadline ? new Date(q.responseDeadline) < new Date() : days > 7;

      return {
        id: q.id,
        entityType: 'SC' as const,
        sequentialNumber: q.sequentialNumber,
        urgency: rc.urgency as 'NORMAL' | 'URGENTE' | 'EMERGENCIAL',
        requesterName: rc.creator?.name ?? 'Desconhecido',
        totalValue,
        daysInStage: days,
        isOverdue: overdue,
        farmId: rc.farm?.id ?? rc.farmId,
        farmName: rc.farm?.name ?? '',
      };
    },
  );
}

// ─── Purchase Order (OC) Cards ───────────────────────────────────────────────

async function getPurchaseOrderCards(
  tx: TxClient,
  organizationId: string,
  filters: KanbanFilters,
): Promise<{ emitida: KanbanCard[]; aguardandoEntrega: KanbanCard[] }> {
  const where: Record<string, unknown> = {
    organizationId,
    deletedAt: null,
    status: { in: ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO'] },
  };
  if (filters.search) {
    where.sequentialNumber = { contains: filters.search, mode: 'insensitive' };
  }

  // farmId and urgency filters go through the quotation → purchaseRequest chain
  const quotationFilter: Record<string, unknown> = {};
  if (filters.farmId || filters.urgency) {
    const rcFilter: Record<string, unknown> = {};
    if (filters.farmId) rcFilter.farmId = filters.farmId;
    if (filters.urgency) rcFilter.urgency = filters.urgency;
    quotationFilter.purchaseRequest = rcFilter;
  }
  if (Object.keys(quotationFilter).length > 0) {
    where.quotation = quotationFilter;
  }

  const orders = await tx.purchaseOrder.findMany({
    where,
    select: {
      id: true,
      sequentialNumber: true,
      status: true,
      updatedAt: true,
      expectedDeliveryDate: true,
      createdBy: true,
      creator: { select: { id: true, name: true } },
      items: { select: { totalPrice: true } },
      quotation: {
        select: {
          purchaseRequest: {
            select: {
              farmId: true,
              urgency: true,
              farm: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const emitida: KanbanCard[] = [];
  const aguardandoEntrega: KanbanCard[] = [];

  for (const oc of orders) {
    const totalValue = oc.items.reduce(
      (sum: number, item: { totalPrice: { toNumber: () => number } }) => {
        return sum + Number(item.totalPrice);
      },
      0,
    );

    const days = daysInStage(oc.updatedAt);
    const overdue = oc.expectedDeliveryDate
      ? new Date(oc.expectedDeliveryDate) < new Date()
      : days > 14;

    const rc = oc.quotation?.purchaseRequest;
    const farmId = rc?.farm?.id ?? rc?.farmId ?? '';
    const farmName = rc?.farm?.name ?? '';
    const urgency = rc?.urgency as 'NORMAL' | 'URGENTE' | 'EMERGENCIAL' | undefined;

    const card: KanbanCard = {
      id: oc.id,
      entityType: 'OC',
      sequentialNumber: oc.sequentialNumber,
      urgency,
      requesterName: oc.creator?.name ?? 'Desconhecido',
      totalValue,
      daysInStage: days,
      isOverdue: overdue,
      farmId,
      farmName,
    };

    if (oc.status === 'EM_TRANSITO') {
      aguardandoEntrega.push(card);
    } else {
      emitida.push(card);
    }
  }

  return { emitida, aguardandoEntrega };
}

// ─── Goods Receipt (GR) Cards — RECEBIDO column ──────────────────────────────

async function getGoodsReceiptCards(
  tx: TxClient,
  organizationId: string,
  filters: KanbanFilters,
): Promise<KanbanCard[]> {
  const where: Record<string, unknown> = {
    organizationId,
    deletedAt: null,
    status: 'CONFIRMADO',
    payableId: null, // GR with confirmed status but no paid payable
  };
  if (filters.search) {
    where.sequentialNumber = { contains: filters.search, mode: 'insensitive' };
  }

  const poFilter: Record<string, unknown> = {};
  if (filters.farmId || filters.urgency) {
    const rcFilter: Record<string, unknown> = {};
    if (filters.farmId) rcFilter.farmId = filters.farmId;
    if (filters.urgency) rcFilter.urgency = filters.urgency;
    poFilter.quotation = { purchaseRequest: rcFilter };
    where.purchaseOrder = poFilter;
  }

  const receipts = await tx.goodsReceipt.findMany({
    where,
    select: {
      id: true,
      sequentialNumber: true,
      updatedAt: true,
      confirmedAt: true,
      creator: { select: { id: true, name: true } },
      items: { select: { totalPrice: true } },
      purchaseOrder: {
        select: {
          quotation: {
            select: {
              purchaseRequest: {
                select: {
                  farmId: true,
                  urgency: true,
                  farm: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      storageFarmId: true,
    },
  });

  return receipts.map(
    (gr: {
      id: string;
      sequentialNumber: string;
      updatedAt: Date;
      confirmedAt: Date | null;
      storageFarmId: string | null;
      creator: { id: string; name: string } | null;
      items: { totalPrice: { toNumber: () => number } }[];
      purchaseOrder: {
        quotation: {
          purchaseRequest: {
            farmId: string;
            urgency: string;
            farm: { id: string; name: string } | null;
          } | null;
        } | null;
      } | null;
    }) => {
      const totalValue = gr.items.reduce(
        (sum: number, item: { totalPrice: { toNumber: () => number } }) => {
          return sum + Number(item.totalPrice);
        },
        0,
      );

      const ref = gr.confirmedAt ?? gr.updatedAt;
      const days = daysInStage(ref);
      const overdue = days > 7;

      const rc = gr.purchaseOrder?.quotation?.purchaseRequest;
      const farmId = rc?.farm?.id ?? rc?.farmId ?? gr.storageFarmId ?? '';
      const farmName = rc?.farm?.name ?? '';
      const urgency = rc?.urgency as 'NORMAL' | 'URGENTE' | 'EMERGENCIAL' | undefined;

      return {
        id: gr.id,
        entityType: 'GR' as const,
        sequentialNumber: gr.sequentialNumber,
        urgency,
        requesterName: gr.creator?.name ?? 'Desconhecido',
        totalValue,
        daysInStage: days,
        isOverdue: overdue,
        farmId,
        farmName,
      };
    },
  );
}

// ─── Payable Cards — PAGO column (last 30 days) ──────────────────────────────

async function getPaidPayableCards(
  tx: TxClient,
  organizationId: string,
  filters: KanbanFilters,
): Promise<KanbanCard[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_PER_DAY);

  const where: Record<string, unknown> = {
    organizationId,
    status: 'PAID',
    paidAt: { gte: thirtyDaysAgo },
    goodsReceiptId: { not: null },
  };
  if (filters.farmId) where.farmId = filters.farmId;

  const payables = await tx.payable.findMany({
    where,
    select: {
      id: true,
      description: true,
      totalAmount: true,
      paidAt: true,
      updatedAt: true,
      supplierName: true,
      farmId: true,
      farm: { select: { id: true, name: true } },
    },
  });

  return payables.map(
    (p: {
      id: string;
      description: string;
      totalAmount: { toNumber: () => number };
      paidAt: Date | null;
      updatedAt: Date;
      supplierName: string;
      farmId: string;
      farm: { id: string; name: string } | null;
    }) => {
      const ref = p.paidAt ?? p.updatedAt;
      const days = daysInStage(ref);

      return {
        id: p.id,
        entityType: 'PAYABLE' as const,
        sequentialNumber: p.description,
        urgency: undefined,
        requesterName: p.supplierName,
        totalValue: Number(p.totalAmount),
        daysInStage: days,
        isOverdue: false,
        farmId: p.farm?.id ?? p.farmId,
        farmName: p.farm?.name ?? '',
      };
    },
  );
}

// ─── Assemble Board ───────────────────────────────────────────────────────────

export async function getKanbanBoard(
  ctx: RlsContext,
  filters: KanbanFilters,
): Promise<KanbanBoard> {
  return withRlsContext(ctx, async (tx) => {
    const [rcCards, quotationCards, ocCards, grCards, payableCards] = await Promise.all([
      getPurchaseRequestCards(tx, ctx.organizationId, filters),
      getQuotationCards(tx, ctx.organizationId, filters),
      getPurchaseOrderCards(tx, ctx.organizationId, filters),
      getGoodsReceiptCards(tx, ctx.organizationId, filters),
      getPaidPayableCards(tx, ctx.organizationId, filters),
    ]);

    const columns = [
      {
        id: 'RC_PENDENTE' as const,
        label: 'RC Pendente',
        count: rcCards.pending.length,
        cards: rcCards.pending,
      },
      {
        id: 'RC_APROVADA' as const,
        label: 'RC Aprovada',
        count: rcCards.approved.length,
        cards: rcCards.approved,
      },
      {
        id: 'EM_COTACAO' as const,
        label: 'Em Cotacao',
        count: quotationCards.length,
        cards: quotationCards,
      },
      {
        id: 'OC_EMITIDA' as const,
        label: 'OC Emitida',
        count: ocCards.emitida.length,
        cards: ocCards.emitida,
      },
      {
        id: 'AGUARDANDO_ENTREGA' as const,
        label: 'Aguardando Entrega',
        count: ocCards.aguardandoEntrega.length,
        cards: ocCards.aguardandoEntrega,
      },
      {
        id: 'RECEBIDO' as const,
        label: 'Recebido',
        count: grCards.length,
        cards: grCards,
      },
      {
        id: 'PAGO' as const,
        label: 'Pago',
        count: payableCards.length,
        cards: payableCards,
      },
    ];

    return columns;
  });
}
