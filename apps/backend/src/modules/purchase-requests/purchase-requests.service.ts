import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PurchaseRequestError,
  RC_TYPES,
  RC_URGENCY_LEVELS,
  type CreatePurchaseRequestInput,
  type UpdatePurchaseRequestInput,
  type ListPurchaseRequestsQuery,
} from './purchase-requests.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ─────────────────────────────────────────────────────────

async function getNextSequentialNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.purchaseRequest.findFirst({
    where: {
      organizationId,
      sequentialNumber: { startsWith: `RC-${year}/` },
    },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });

  let lastNum = 0;
  if (last?.sequentialNumber) {
    const parts = last.sequentialNumber.split('/');
    lastNum = parseInt(parts[1] ?? '0', 10);
  }

  return `RC-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}

const RC_INCLUDE = {
  items: true,
  attachments: true,
  approvalActions: {
    include: {
      assignee: { select: { id: true, name: true } },
    },
    orderBy: { step: 'asc' },
  },
  farm: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
  costCenter: { select: { id: true, name: true } },
} as const;

// ─── Create ──────────────────────────────────────────────────────────

export async function createPurchaseRequest(
  ctx: RlsContext & { userId: string },
  input: CreatePurchaseRequestInput,
) {
  // Validate requestType
  if (!(RC_TYPES as readonly string[]).includes(input.requestType)) {
    throw new PurchaseRequestError(
      `Tipo de requisição inválido: ${input.requestType}. Valores permitidos: ${RC_TYPES.join(', ')}`,
      400,
    );
  }

  // Validate urgency
  if (!(RC_URGENCY_LEVELS as readonly string[]).includes(input.urgency)) {
    throw new PurchaseRequestError(
      `Urgência inválida: ${input.urgency}. Valores permitidos: ${RC_URGENCY_LEVELS.join(', ')}`,
      400,
    );
  }

  // Validate items
  if (!input.items || input.items.length < 1) {
    throw new PurchaseRequestError('Adicione pelo menos um item a requisicao.', 400);
  }

  // Validate justification for EMERGENCIAL
  if (input.urgency === 'EMERGENCIAL' && !input.justification) {
    throw new PurchaseRequestError(
      'A justificativa e obrigatoria para requisicoes emergenciais.',
      400,
    );
  }

  return withRlsContext(ctx, async (tx) => {
    const sequentialNumber = await getNextSequentialNumber(tx, ctx.organizationId);

    const rc = await tx.purchaseRequest.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        sequentialNumber,
        requestType: input.requestType,
        urgency: input.urgency,
        status: 'RASCUNHO',
        justification: input.justification ?? null,
        costCenterId: input.costCenterId ?? null,
        neededBy: input.neededBy ? new Date(input.neededBy) : null,
        geolat: input.geolat ?? null,
        geolon: input.geolon ?? null,
        photoUrl: input.photoUrl ?? null,
        createdBy: ctx.userId,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId ?? null,
            productName: i.productName,
            quantity: i.quantity,
            unitId: i.unitId ?? null,
            unitName: i.unitName,
            estimatedUnitPrice: i.estimatedUnitPrice ?? null,
            notes: i.notes ?? null,
          })),
        },
      },
      include: {
        items: true,
        farm: { select: { id: true, name: true } },
      },
    });

    return rc;
  });
}

// ─── Get by ID ───────────────────────────────────────────────────────

export async function getPurchaseRequestById(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const rc = await tx.purchaseRequest.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: RC_INCLUDE,
    });

    if (!rc) {
      throw new PurchaseRequestError('Requisicao nao encontrada', 404);
    }

    return rc;
  });
}

// ─── List ─────────────────────────────────────────────────────────────

export async function listPurchaseRequests(ctx: RlsContext, query: ListPurchaseRequestsQuery) {
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

  if (query.farmId) {
    where.farmId = query.farmId;
  }

  if (query.urgency) {
    where.urgency = query.urgency;
  }

  if (query.createdBy) {
    where.createdBy = query.createdBy;
  }

  if (query.search) {
    where.OR = [
      { sequentialNumber: { contains: query.search, mode: 'insensitive' } },
      { items: { some: { productName: { contains: query.search, mode: 'insensitive' } } } },
    ];
  }

  return withRlsContext(ctx, async (tx) => {
    const [data, total] = await Promise.all([
      tx.purchaseRequest.findMany({
        where,
        include: {
          items: true,
          farm: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      tx.purchaseRequest.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return { data, total, page, limit, totalPages };
  });
}

// ─── Update ──────────────────────────────────────────────────────────

export async function updatePurchaseRequest(
  ctx: RlsContext,
  id: string,
  input: UpdatePurchaseRequestInput,
) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.purchaseRequest.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new PurchaseRequestError('Requisicao nao encontrada', 404);
    }

    if (existing.status !== 'RASCUNHO' && existing.status !== 'DEVOLVIDA') {
      throw new PurchaseRequestError(
        'Requisicao so pode ser editada em status Rascunho ou Devolvida',
        400,
      );
    }

    // Replace items if provided
    if (input.items !== undefined) {
      await tx.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: id } });
      if (input.items.length > 0) {
        await tx.purchaseRequestItem.createMany({
          data: input.items.map((i) => ({
            purchaseRequestId: id,
            productId: i.productId ?? null,
            productName: i.productName,
            quantity: i.quantity,
            unitId: i.unitId ?? null,
            unitName: i.unitName,
            estimatedUnitPrice: i.estimatedUnitPrice ?? null,
            notes: i.notes ?? null,
          })),
        });
      }
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (input.requestType !== undefined) data.requestType = input.requestType;
    if (input.farmId !== undefined) data.farmId = input.farmId;
    if (input.urgency !== undefined) data.urgency = input.urgency;
    if (input.justification !== undefined) data.justification = input.justification;
    if (input.costCenterId !== undefined) data.costCenterId = input.costCenterId;
    if (input.neededBy !== undefined) {
      data.neededBy = input.neededBy ? new Date(input.neededBy) : null;
    }

    const updated = await tx.purchaseRequest.update({
      where: { id },
      data,
      include: RC_INCLUDE,
    });

    return updated;
  });
}

// ─── Delete (soft) ────────────────────────────────────────────────────

export async function deletePurchaseRequest(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.purchaseRequest.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new PurchaseRequestError('Requisicao nao encontrada', 404);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new PurchaseRequestError('Apenas requisicoes em rascunho podem ser excluidas', 400);
    }

    await tx.purchaseRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  });
}
