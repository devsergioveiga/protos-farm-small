import { withRlsContext, type RlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import {
  QuotationError,
  canScTransition,
  type CreateQuotationInput,
  type RegisterProposalInput,
  type ApproveQuotationInput,
  type ListQuotationsQuery,
  type ComparativeMapData,
} from './quotations.types';
import { createNotification } from '../notifications/notifications.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ─────────────────────────────────────────────────────────

async function getNextScSequentialNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.quotation.findFirst({
    where: {
      organizationId,
      sequentialNumber: { startsWith: `SC-${year}/` },
    },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });

  let lastNum = 0;
  if (last?.sequentialNumber) {
    const parts = last.sequentialNumber.split('/');
    lastNum = parseInt(parts[1] ?? '0', 10);
  }

  return `SC-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}

async function getNextOcSequentialNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.purchaseOrder.findFirst({
    where: {
      organizationId,
      sequentialNumber: { startsWith: `OC-${year}/` },
    },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });

  let lastNum = 0;
  if (last?.sequentialNumber) {
    const parts = last.sequentialNumber.split('/');
    lastNum = parseInt(parts[1] ?? '0', 10);
  }

  return `OC-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}

// ─── Create Quotation (SC) ────────────────────────────────────────────

export async function createQuotation(
  ctx: RlsContext & { userId: string },
  input: CreateQuotationInput,
) {
  // Validate supplierIds not empty
  if (!input.supplierIds || input.supplierIds.length < 1) {
    throw new QuotationError('Informe pelo menos um fornecedor para a cotacao.', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate RC exists and is APROVADA
    const rc = await tx.purchaseRequest.findFirst({
      where: { id: input.purchaseRequestId, organizationId: ctx.organizationId, deletedAt: null },
    });

    if (!rc) {
      throw new QuotationError('Requisicao de compra nao encontrada.', 404);
    }

    if (rc.status !== 'APROVADA') {
      throw new QuotationError(
        `Somente RC com status APROVADA pode gerar cotacao. Status atual: ${rc.status}`,
        400,
      );
    }

    // Validate all suppliers exist, are ACTIVE, and belong to org
    const suppliers = await tx.supplier.findMany({
      where: {
        id: { in: input.supplierIds },
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });

    if (suppliers.length !== input.supplierIds.length) {
      throw new QuotationError('Um ou mais fornecedores nao encontrados.', 400);
    }

    const blocked = suppliers.filter((s: { status: string }) => s.status !== 'ACTIVE');
    if (blocked.length > 0) {
      const names = blocked.map((s: { name: string }) => s.name).join(', ');
      throw new QuotationError(`Fornecedores bloqueados ou inativos: ${names}`, 400);
    }

    // Generate sequential number
    const sequentialNumber = await getNextScSequentialNumber(tx, ctx.organizationId);

    // Create Quotation + QuotationSupplier rows
    const quotation = await tx.quotation.create({
      data: {
        organizationId: ctx.organizationId,
        purchaseRequestId: input.purchaseRequestId,
        sequentialNumber,
        status: 'RASCUNHO',
        responseDeadline: input.responseDeadline ? new Date(input.responseDeadline) : null,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
        suppliers: {
          create: input.supplierIds.map((supplierId) => ({ supplierId })),
        },
      },
      include: {
        suppliers: { include: { supplier: true } },
        purchaseRequest: { select: { id: true, sequentialNumber: true, status: true } },
      },
    });

    // Immediately transition to AGUARDANDO_PROPOSTA
    const updated = await tx.quotation.update({
      where: { id: quotation.id },
      data: { status: 'AGUARDANDO_PROPOSTA' },
      include: {
        suppliers: { include: { supplier: true } },
        purchaseRequest: { select: { id: true, sequentialNumber: true, status: true } },
      },
    });

    return updated;
  });
}

// ─── List Quotations ──────────────────────────────────────────────────

export async function listQuotations(ctx: RlsContext, query: ListQuotationsQuery) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.purchaseRequestId) {
    where.purchaseRequestId = query.purchaseRequestId;
  }

  if (query.search) {
    where.OR = [
      { sequentialNumber: { contains: query.search, mode: 'insensitive' } },
      {
        purchaseRequest: {
          sequentialNumber: { contains: query.search, mode: 'insensitive' },
        },
      },
    ];
  }

  return withRlsContext(ctx, async (tx) => {
    const [data, total] = await Promise.all([
      tx.quotation.findMany({
        where,
        include: {
          purchaseRequest: {
            select: { id: true, sequentialNumber: true, requestType: true, urgency: true },
          },
          _count: { select: { suppliers: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      tx.quotation.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return { data, total, page, limit, totalPages };
  });
}

// ─── Get Quotation By ID ──────────────────────────────────────────────

export async function getQuotationById(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const quotation = await tx.quotation.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        purchaseRequest: {
          include: { items: true },
        },
        suppliers: {
          include: {
            supplier: true,
            proposal: {
              include: { items: true },
            },
          },
        },
        itemSelections: true,
      },
    });

    if (!quotation) {
      throw new QuotationError('Cotacao nao encontrada.', 404);
    }

    return quotation;
  });
}

// ─── Register Proposal ───────────────────────────────────────────────

export async function registerProposal(
  ctx: RlsContext,
  quotationId: string,
  quotationSupplierId: string,
  input: RegisterProposalInput,
  file?: { url: string; name: string },
) {
  return withRlsContext(ctx, async (tx) => {
    // Validate quotation
    const quotation = await tx.quotation.findFirst({
      where: { id: quotationId, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        purchaseRequest: { include: { items: true } },
        suppliers: { include: { proposal: true } },
      },
    });

    if (!quotation) {
      throw new QuotationError('Cotacao nao encontrada.', 404);
    }

    if (!['AGUARDANDO_PROPOSTA', 'EM_ANALISE'].includes(quotation.status)) {
      throw new QuotationError(
        `Proposta nao pode ser registrada no status: ${quotation.status}`,
        400,
      );
    }

    // Validate quotationSupplierId belongs to this quotation
    const qs = quotation.suppliers.find((s: { id: string }) => s.id === quotationSupplierId);
    if (!qs) {
      throw new QuotationError('Fornecedor nao pertence a esta cotacao.', 400);
    }

    // Validate each item's purchaseRequestItemId belongs to the RC
    const rcItemIds = new Set(quotation.purchaseRequest.items.map((i: { id: string }) => i.id));
    for (const item of input.items) {
      if (!rcItemIds.has(item.purchaseRequestItemId)) {
        throw new QuotationError(
          `Item ${item.purchaseRequestItemId} nao pertence a requisicao desta cotacao.`,
          400,
        );
      }
    }

    // Upsert QuotationProposal
    const proposalData = {
      freightTotal: input.freightTotal ?? null,
      taxTotal: input.taxTotal ?? null,
      paymentTerms: input.paymentTerms ?? null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      deliveryDays: input.deliveryDays ?? null,
      notes: input.notes ?? null,
      fileUrl: file?.url ?? null,
      fileName: file?.name ?? null,
    };

    // Delete existing proposal items if proposal exists
    const existingProposal = await tx.quotationProposal.findUnique({
      where: { quotationSupplierId },
    });

    if (existingProposal) {
      await tx.quotationProposalItem.deleteMany({ where: { proposalId: existingProposal.id } });
      await tx.quotationProposal.update({
        where: { id: existingProposal.id },
        data: {
          ...proposalData,
          items: {
            create: input.items.map((item) => ({
              purchaseRequestItemId: item.purchaseRequestItemId,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              totalPrice: Number(item.unitPrice) * Number(item.quantity),
              notes: item.notes ?? null,
            })),
          },
        },
      });
    } else {
      await tx.quotationProposal.create({
        data: {
          quotationSupplierId,
          ...proposalData,
          items: {
            create: input.items.map((item) => ({
              purchaseRequestItemId: item.purchaseRequestItemId,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              totalPrice: Number(item.unitPrice) * Number(item.quantity),
              notes: item.notes ?? null,
            })),
          },
        },
      });
    }

    // Check if all suppliers have submitted proposals
    const updatedSuppliers = await tx.quotationSupplier.findMany({
      where: { quotationId },
      include: { proposal: true },
    });

    const allSubmitted = updatedSuppliers.every((s: { proposal: unknown }) => s.proposal !== null);

    // Auto-transition to EM_ANALISE if all proposals are in
    if (allSubmitted && quotation.status === 'AGUARDANDO_PROPOSTA') {
      await tx.quotation.update({
        where: { id: quotationId },
        data: { status: 'EM_ANALISE' },
      });
    }

    // Return updated quotation
    return tx.quotation.findFirst({
      where: { id: quotationId },
      include: {
        purchaseRequest: { include: { items: true } },
        suppliers: {
          include: {
            supplier: true,
            proposal: { include: { items: true } },
          },
        },
        itemSelections: true,
      },
    });
  });
}

// ─── Get Comparative Map ──────────────────────────────────────────────

export async function getComparativeMap(
  ctx: RlsContext,
  quotationId: string,
): Promise<ComparativeMapData> {
  return withRlsContext(ctx, async (tx) => {
    const quotation = await tx.quotation.findFirst({
      where: { id: quotationId, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        purchaseRequest: { include: { items: true } },
        suppliers: {
          include: {
            supplier: true,
            proposal: { include: { items: true } },
          },
        },
      },
    });

    if (!quotation) {
      throw new QuotationError('Cotacao nao encontrada.', 404);
    }

    // Build items with lastPricePaid
    const items = await Promise.all(
      quotation.purchaseRequest.items.map(
        async (rcItem: {
          id: string;
          productName: string;
          unitName: string;
          quantity: unknown;
        }) => {
          // Look for last price paid from a completed PO linked to this RC item
          const lastPOItem = await tx.purchaseOrderItem.findFirst({
            where: {
              purchaseRequestItemId: rcItem.id,
              purchaseOrder: {
                status: { in: ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO', 'ENTREGUE'] },
              },
            },
            orderBy: { purchaseOrder: { createdAt: 'desc' } },
            select: { unitPrice: true },
          });

          return {
            purchaseRequestItemId: rcItem.id,
            productName: rcItem.productName,
            unitName: rcItem.unitName,
            quantity: Number(rcItem.quantity),
            lastPricePaid: lastPOItem ? Number(lastPOItem.unitPrice) : null,
          };
        },
      ),
    );

    // Build suppliers array
    const suppliers = quotation.suppliers.map(
      (qs: {
        id: string;
        supplierId: string;
        supplier: { name: string; averageRating?: number | null };
        proposal: {
          id: string;
          freightTotal: unknown;
          taxTotal: unknown;
          deliveryDays: number | null;
          paymentTerms: string | null;
          validUntil: Date | null;
          items: {
            purchaseRequestItemId: string;
            unitPrice: unknown;
            quantity: unknown;
            totalPrice: unknown;
            notes: string | null;
          }[];
        } | null;
      }) => ({
        supplierId: qs.supplierId,
        supplierName: qs.supplier.name,
        rating: qs.supplier.averageRating ?? null,
        quotationSupplierId: qs.id,
        proposalId: qs.proposal?.id ?? null,
        freightTotal: qs.proposal ? Number(qs.proposal.freightTotal) : null,
        taxTotal: qs.proposal ? Number(qs.proposal.taxTotal) : null,
        deliveryDays: qs.proposal?.deliveryDays ?? null,
        paymentTerms: qs.proposal?.paymentTerms ?? null,
        validUntil: qs.proposal?.validUntil?.toISOString() ?? null,
        proposalItems: (qs.proposal?.items ?? []).map(
          (pi: {
            purchaseRequestItemId: string;
            unitPrice: unknown;
            quantity: unknown;
            totalPrice: unknown;
            notes: string | null;
          }) => ({
            purchaseRequestItemId: pi.purchaseRequestItemId,
            unitPrice: Number(pi.unitPrice),
            quantity: Number(pi.quantity),
            totalPrice: Number(pi.totalPrice),
            notes: pi.notes,
          }),
        ),
      }),
    );

    // Compute per-item min/max across all proposals
    const perItemMinPrice: Record<string, number | null> = {};
    const perItemMaxPrice: Record<string, number | null> = {};

    for (const item of items) {
      const prices = suppliers
        .flatMap((s: { proposalItems: { purchaseRequestItemId: string; unitPrice: number }[] }) =>
          s.proposalItems.filter(
            (pi: { purchaseRequestItemId: string }) =>
              pi.purchaseRequestItemId === item.purchaseRequestItemId,
          ),
        )
        .map((pi: { unitPrice: number }) => pi.unitPrice);

      perItemMinPrice[item.purchaseRequestItemId] = prices.length > 0 ? Math.min(...prices) : null;
      perItemMaxPrice[item.purchaseRequestItemId] = prices.length > 0 ? Math.max(...prices) : null;
    }

    return { items, suppliers, perItemMinPrice, perItemMaxPrice };
  });
}

// ─── Approve Quotation ───────────────────────────────────────────────

export async function approveQuotation(
  ctx: RlsContext & { userId: string },
  quotationId: string,
  input: ApproveQuotationInput,
) {
  return withRlsContext(ctx, async (tx) => {
    // Validate SC status
    const quotation = await tx.quotation.findFirst({
      where: { id: quotationId, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        purchaseRequest: { include: { items: true } },
        suppliers: {
          include: {
            proposal: { include: { items: true } },
            supplier: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new QuotationError('Cotacao nao encontrada.', 404);
    }

    if (quotation.status !== 'EM_ANALISE') {
      throw new QuotationError(
        `Cotacao deve estar em EM_ANALISE para ser aprovada. Status atual: ${quotation.status}`,
        400,
      );
    }

    // Validate selectedItems
    if (!input.selectedItems || input.selectedItems.length === 0) {
      throw new QuotationError('Selecione pelo menos um item para aprovacao.', 400);
    }

    const rcItemIds = new Set(quotation.purchaseRequest.items.map((i: { id: string }) => i.id));
    const qsIds = new Set(quotation.suppliers.map((s: { id: string }) => s.id));

    for (const sel of input.selectedItems) {
      if (!rcItemIds.has(sel.purchaseRequestItemId)) {
        throw new QuotationError(
          `Item ${sel.purchaseRequestItemId} nao pertence a requisicao desta cotacao.`,
          400,
        );
      }
      if (!qsIds.has(sel.quotationSupplierId)) {
        throw new QuotationError(
          `Fornecedor da cotacao ${sel.quotationSupplierId} nao pertence a esta cotacao.`,
          400,
        );
      }
    }

    // Check if justification is needed (any selected supplier is NOT the lowest price for their item)
    // Build per-item min price map from proposals
    const perItemMin: Record<string, number> = {};
    for (const qs of quotation.suppliers) {
      if (!qs.proposal) continue;
      for (const pi of qs.proposal.items) {
        const price = Number(pi.unitPrice);
        if (
          perItemMin[pi.purchaseRequestItemId] === undefined ||
          price < perItemMin[pi.purchaseRequestItemId]
        ) {
          perItemMin[pi.purchaseRequestItemId] = price;
        }
      }
    }

    // Check each selection for non-lowest-price scenario
    let justificationRequired = false;
    for (const sel of input.selectedItems) {
      const qs = quotation.suppliers.find((s: { id: string }) => s.id === sel.quotationSupplierId);
      const pi = qs?.proposal?.items.find(
        (i: { purchaseRequestItemId: string }) =>
          i.purchaseRequestItemId === sel.purchaseRequestItemId,
      );

      if (pi) {
        const selectedPrice = Number(pi.unitPrice);
        const minPrice = perItemMin[sel.purchaseRequestItemId];
        if (minPrice !== undefined && selectedPrice > minPrice) {
          justificationRequired = true;
          break;
        }
      }
    }

    if (justificationRequired && !input.justification) {
      throw new QuotationError(
        'Justificativa obrigatoria quando nao e escolhido o menor preco em algum item.',
        400,
      );
    }

    // Execute in a single transaction
    const purchaseOrders: unknown[] = [];

    // a. Delete + recreate QuotationItemSelection
    await tx.quotationItemSelection.deleteMany({ where: { quotationId } });
    await tx.quotationItemSelection.createMany({
      data: input.selectedItems.map((sel) => ({
        quotationId,
        purchaseRequestItemId: sel.purchaseRequestItemId,
        quotationSupplierId: sel.quotationSupplierId,
      })),
    });

    // b. Update Quotation
    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        status: 'APROVADA',
        approvedBy: ctx.userId,
        approvedAt: new Date(),
        approvalJustification: input.justification ?? null,
      },
    });

    // c. Group selectedItems by quotationSupplierId
    const bySupplier = new Map<string, typeof input.selectedItems>();
    for (const sel of input.selectedItems) {
      const list = bySupplier.get(sel.quotationSupplierId) ?? [];
      list.push(sel);
      bySupplier.set(sel.quotationSupplierId, list);
    }

    // d. For each winning supplier, create a PurchaseOrder
    for (const [qsId, sels] of bySupplier.entries()) {
      const qs = quotation.suppliers.find((s: { id: string }) => s.id === qsId);
      if (!qs) continue;

      const ocNumber = await getNextOcSequentialNumber(tx, ctx.organizationId);

      // Build PO items from proposal
      const poItems = sels.map((sel) => {
        const pi = qs.proposal?.items.find(
          (i: { purchaseRequestItemId: string }) =>
            i.purchaseRequestItemId === sel.purchaseRequestItemId,
        );
        const rcItem = quotation.purchaseRequest.items.find(
          (i: { id: string }) => i.id === sel.purchaseRequestItemId,
        );

        if (!pi || !rcItem) {
          throw new QuotationError(`Proposta ou item nao encontrado para fornecedor ${qsId}`, 400);
        }

        return {
          purchaseRequestItemId: sel.purchaseRequestItemId,
          productName: rcItem.productName,
          unitName: rcItem.unitName,
          quantity: Number(pi.quantity),
          unitPrice: Number(pi.unitPrice),
          totalPrice: Number(pi.totalPrice),
          notes: pi.notes ?? null,
        };
      });

      const po = await tx.purchaseOrder.create({
        data: {
          organizationId: ctx.organizationId,
          quotationId,
          supplierId: qs.supplierId,
          sequentialNumber: ocNumber,
          status: 'EMITIDA',
          issuedAt: new Date(),
          createdBy: ctx.userId,
          items: {
            create: poItems,
          },
        },
        include: { items: true, supplier: true },
      });

      purchaseOrders.push(po);
    }

    // e. Transition SC to FECHADA
    await tx.quotation.update({
      where: { id: quotationId },
      data: { status: 'FECHADA' },
    });

    const finalQuotation = await tx.quotation.findFirst({
      where: { id: quotationId },
      include: {
        purchaseRequest: { include: { items: true } },
        suppliers: {
          include: {
            supplier: true,
            proposal: { include: { items: true } },
          },
        },
        itemSelections: true,
      },
    });

    // After transaction: fire-and-forget notification
    void (async () => {
      try {
        await prisma.notification.create({
          data: {
            organizationId: ctx.organizationId,
            recipientId: ctx.userId,
            type: 'QUOTATION_APPROVED',
            title: 'Cotacao aprovada',
            body: `Cotacao aprovada com ${purchaseOrders.length} ordem(ns) de compra gerada(s).`,
            referenceId: quotationId,
            referenceType: 'quotation',
          },
        });
      } catch (err) {
        console.warn('Notification creation failed', err);
      }
    })();

    return { quotation: finalQuotation, purchaseOrders };
  });
}

// ─── Transition Quotation ─────────────────────────────────────────────

export async function transitionQuotation(ctx: RlsContext, id: string, toStatus: string) {
  return withRlsContext(ctx, async (tx) => {
    const quotation = await tx.quotation.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    });

    if (!quotation) {
      throw new QuotationError('Cotacao nao encontrada.', 404);
    }

    if (!canScTransition(quotation.status, toStatus)) {
      throw new QuotationError(`Transicao invalida: ${quotation.status} -> ${toStatus}`, 400);
    }

    return tx.quotation.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: toStatus as any },
    });
  });
}

// ─── Delete Quotation (soft) ──────────────────────────────────────────

export async function deleteQuotation(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const quotation = await tx.quotation.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    });

    if (!quotation) {
      throw new QuotationError('Cotacao nao encontrada.', 404);
    }

    if (quotation.status !== 'RASCUNHO') {
      throw new QuotationError('Apenas cotacoes em rascunho podem ser excluidas.', 400);
    }

    await tx.quotation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  });
}

// Re-export for potential use
export { createNotification };
