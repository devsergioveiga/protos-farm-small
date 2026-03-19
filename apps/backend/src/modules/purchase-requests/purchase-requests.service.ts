import { withRlsContext, type RlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import {
  PurchaseRequestError,
  RC_TYPES,
  RC_URGENCY_LEVELS,
  SLA_HOURS,
  canTransition,
  type CreatePurchaseRequestInput,
  type UpdatePurchaseRequestInput,
  type ListPurchaseRequestsQuery,
  type TransitionInput,
} from './purchase-requests.types';
import { matchApprovalRule, resolveApprover } from '../approval-rules/approval-rules.service';
import {
  createNotification,
  dispatchPushNotification,
} from '../notifications/notifications.service';
import { checkBudgetExceeded } from '../purchase-budgets/purchase-budgets.service';

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

// ─── Transition Purchase Request ─────────────────────────────────────

export async function transitionPurchaseRequest(
  ctx: RlsContext & { userId: string },
  id: string,
  input: TransitionInput,
) {
  return withRlsContext(ctx, async (tx) => {
    const rc = await tx.purchaseRequest.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        items: true,
        approvalActions: { orderBy: { step: 'asc' } },
      },
    });

    if (!rc) {
      throw new PurchaseRequestError('Requisicao nao encontrada', 404);
    }

    if (input.action === 'SUBMIT') {
      if (!canTransition(rc.status, 'PENDENTE')) {
        throw new PurchaseRequestError(`Transicao invalida: ${rc.status} -> PENDENTE`, 400);
      }

      // Calculate total (both quantity and estimatedUnitPrice are Decimal)
      const total = rc.items.reduce((sum, item) => {
        if (item.estimatedUnitPrice !== null) {
          return sum + Number(item.estimatedUnitPrice) * Number(item.quantity);
        }
        return sum;
      }, 0);

      // Match approval rule
      const rule = await matchApprovalRule(tx, ctx.organizationId, rc.requestType, total);
      if (!rule) {
        throw new PurchaseRequestError(
          'Nenhuma regra de alcada configurada para este tipo e valor',
          400,
        );
      }

      // Resolve approver1
      const resolved1 = await resolveApprover(tx, rule.approver1Id, ctx.organizationId);

      // Create ApprovalAction step 1
      await tx.approvalAction.create({
        data: {
          purchaseRequestId: id,
          organizationId: ctx.organizationId,
          step: 1,
          assignedTo: resolved1,
          originalAssignee: resolved1 !== rule.approver1Id ? rule.approver1Id : null,
          status: 'PENDING',
        },
      });

      // Create ApprovalAction step 2 if double approval
      if (rule.approverCount === 2 && rule.approver2Id) {
        const resolved2 = await resolveApprover(tx, rule.approver2Id, ctx.organizationId);
        await tx.approvalAction.create({
          data: {
            purchaseRequestId: id,
            organizationId: ctx.organizationId,
            step: 2,
            assignedTo: resolved2,
            originalAssignee: resolved2 !== rule.approver2Id ? rule.approver2Id : null,
            status: 'PENDING',
          },
        });
      }

      // Compute SLA deadline
      const slaHours = SLA_HOURS[rc.urgency];
      const slaDeadline =
        slaHours !== null ? new Date(Date.now() + slaHours * 60 * 60 * 1000) : null;

      // Update RC to PENDENTE
      await tx.purchaseRequest.update({
        where: { id },
        data: {
          status: 'PENDENTE',
          submittedAt: new Date(),
          slaDeadline,
        },
      });

      // Create notification for step 1 approver
      const notification = await createNotification(tx, ctx.organizationId, {
        recipientId: resolved1,
        type: 'RC_PENDING',
        title: 'Nova requisicao para aprovar',
        body: `${rc.sequentialNumber} aguarda sua aprovacao.`,
        referenceId: id,
        referenceType: 'purchase_request',
      });

      // Fire-and-forget push dispatch
      void dispatchPushNotification(notification).catch((err: Error) => {
        console.warn('Push dispatch failed', err);
      });

      return tx.purchaseRequest.findFirst({
        where: { id },
        include: RC_INCLUDE,
      });
    }

    if (input.action === 'APPROVE') {
      // Find current user's pending ApprovalAction
      const currentAction = rc.approvalActions.find(
        (a) => a.assignedTo === ctx.userId && a.status === 'PENDING',
      );
      if (!currentAction) {
        throw new PurchaseRequestError('Voce nao tem permissao para aprovar esta requisicao', 403);
      }

      // Update ApprovalAction
      await tx.approvalAction.update({
        where: { id: currentAction.id },
        data: {
          status: 'APPROVED',
          comment: input.comment ?? null,
          decidedAt: new Date(),
        },
      });

      // Check for remaining pending steps
      const nextPending = rc.approvalActions.find(
        (a) => a.step > currentAction.step && a.status === 'PENDING',
      );

      if (nextPending) {
        // Notify next approver
        const notification = await createNotification(tx, ctx.organizationId, {
          recipientId: nextPending.assignedTo,
          type: 'RC_PENDING',
          title: 'Nova requisicao para aprovar',
          body: `${rc.sequentialNumber} aguarda sua aprovacao.`,
          referenceId: id,
          referenceType: 'purchase_request',
        });
        void dispatchPushNotification(notification).catch((err: Error) => {
          console.warn('Push dispatch failed', err);
        });
      } else {
        // All steps resolved — approve RC

        // Budget check (non-blocking)
        const rcTotal = rc.items.reduce((sum, item) => {
          if (item.estimatedUnitPrice !== null) {
            return sum + Number(item.estimatedUnitPrice) * Number(item.quantity);
          }
          return sum;
        }, 0);

        const budgetCheck = await checkBudgetExceeded(
          tx,
          ctx.organizationId,
          rc.requestType,
          rc.farmId,
          rcTotal,
        );

        await tx.purchaseRequest.update({
          where: { id },
          data: {
            status: 'APROVADA',
            budgetExceeded: budgetCheck.exceeded,
          },
        });

        // Notify creator
        const notification = await createNotification(tx, ctx.organizationId, {
          recipientId: rc.createdBy,
          type: 'RC_APPROVED',
          title: 'Requisicao aprovada',
          body: `${rc.sequentialNumber} foi aprovada.`,
          referenceId: id,
          referenceType: 'purchase_request',
        });
        void dispatchPushNotification(notification).catch((err: Error) => {
          console.warn('Push dispatch failed', err);
        });

        // Notify approver + FINANCIAL if budget exceeded
        if (budgetCheck.exceeded) {
          // Notify the approver
          void createNotification(tx, ctx.organizationId, {
            recipientId: ctx.userId,
            type: 'BUDGET_EXCEEDED',
            title: 'Orcamento excedido',
            body: `A aprovacao de ${rc.sequentialNumber} ultrapassou o orcamento configurado.`,
            referenceId: id,
            referenceType: 'purchase_request',
          }).catch(() => {});

          // Notify FINANCIAL role users
          const financialUsers = await tx.user.findMany({
            where: { organizationId: ctx.organizationId, role: 'FINANCIAL' },
            select: { id: true },
            take: 5,
          });
          for (const u of financialUsers) {
            void createNotification(tx, ctx.organizationId, {
              recipientId: u.id,
              type: 'BUDGET_EXCEEDED',
              title: 'Orcamento excedido',
              body: `Requisicao ${rc.sequentialNumber} ultrapassou o orcamento ao ser aprovada.`,
              referenceId: id,
              referenceType: 'purchase_request',
            }).catch(() => {});
          }
        }
      }

      return tx.purchaseRequest.findFirst({
        where: { id },
        include: RC_INCLUDE,
      });
    }

    if (input.action === 'REJECT') {
      if (!input.comment) {
        throw new PurchaseRequestError('Motivo obrigatorio ao rejeitar', 400);
      }

      const currentAction = rc.approvalActions.find(
        (a) => a.assignedTo === ctx.userId && a.status === 'PENDING',
      );
      if (!currentAction) {
        throw new PurchaseRequestError('Voce nao tem permissao para rejeitar esta requisicao', 403);
      }

      await tx.approvalAction.update({
        where: { id: currentAction.id },
        data: {
          status: 'REJECTED',
          comment: input.comment,
          decidedAt: new Date(),
        },
      });

      await tx.purchaseRequest.update({
        where: { id },
        data: { status: 'REJEITADA' },
      });

      const notification = await createNotification(tx, ctx.organizationId, {
        recipientId: rc.createdBy,
        type: 'RC_REJECTED',
        title: 'Requisicao rejeitada',
        body: `${rc.sequentialNumber} foi rejeitada. Motivo: ${input.comment}`,
        referenceId: id,
        referenceType: 'purchase_request',
      });
      void dispatchPushNotification(notification).catch((err: Error) => {
        console.warn('Push dispatch failed', err);
      });

      return tx.purchaseRequest.findFirst({
        where: { id },
        include: RC_INCLUDE,
      });
    }

    if (input.action === 'RETURN') {
      if (!input.comment) {
        throw new PurchaseRequestError('Motivo obrigatorio ao devolver', 400);
      }

      const currentAction = rc.approvalActions.find(
        (a) => a.assignedTo === ctx.userId && a.status === 'PENDING',
      );
      if (!currentAction) {
        throw new PurchaseRequestError('Voce nao tem permissao para devolver esta requisicao', 403);
      }

      await tx.approvalAction.update({
        where: { id: currentAction.id },
        data: {
          status: 'RETURNED',
          comment: input.comment,
          decidedAt: new Date(),
        },
      });

      await tx.purchaseRequest.update({
        where: { id },
        data: { status: 'DEVOLVIDA' },
      });

      const notification = await createNotification(tx, ctx.organizationId, {
        recipientId: rc.createdBy,
        type: 'RC_RETURNED',
        title: 'Requisicao devolvida',
        body: `${rc.sequentialNumber} foi devolvida. Motivo: ${input.comment}`,
        referenceId: id,
        referenceType: 'purchase_request',
      });
      void dispatchPushNotification(notification).catch((err: Error) => {
        console.warn('Push dispatch failed', err);
      });

      return tx.purchaseRequest.findFirst({
        where: { id },
        include: RC_INCLUDE,
      });
    }

    if (input.action === 'CANCEL') {
      if (!canTransition(rc.status, 'CANCELADA')) {
        throw new PurchaseRequestError(`Transicao invalida: ${rc.status} -> CANCELADA`, 400);
      }

      await tx.purchaseRequest.update({
        where: { id },
        data: { status: 'CANCELADA', cancelledAt: new Date() },
      });

      return tx.purchaseRequest.findFirst({
        where: { id },
        include: RC_INCLUDE,
      });
    }

    throw new PurchaseRequestError(`Acao invalida: ${input.action}`, 400);
  });
}

// ─── Process SLA Reminders ────────────────────────────────────────────

export async function processSlaReminders(): Promise<number> {
  // Find PENDENTE RCs where slaDeadline is within 1 hour and slaNotifiedAt is null
  const rcs = await prisma.purchaseRequest.findMany({
    where: {
      status: 'PENDENTE',
      slaDeadline: { lte: new Date(Date.now() + 60 * 60 * 1000) },
      slaNotifiedAt: null,
      deletedAt: null,
    },
    include: { approvalActions: { where: { status: 'PENDING' } } },
  });

  let count = 0;

  for (const rc of rcs) {
    // Create SLA_REMINDER notification for each pending approver
    for (const action of rc.approvalActions) {
      await prisma.notification.create({
        data: {
          organizationId: rc.organizationId,
          recipientId: action.assignedTo,
          type: 'SLA_REMINDER',
          title: 'Prazo de aprovacao se aproximando',
          body: `${rc.sequentialNumber} vence em breve.`,
          referenceId: rc.id,
          referenceType: 'purchase_request',
        },
      });
      count++;
    }

    // Mark slaNotifiedAt
    await prisma.purchaseRequest.update({
      where: { id: rc.id },
      data: { slaNotifiedAt: new Date() },
    });
  }

  return count;
}
