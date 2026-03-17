import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import {
  ApprovalRuleError,
  type CreateApprovalRuleInput,
  type UpdateApprovalRuleInput,
  type CreateDelegationInput,
} from './approval-rules.types';

// ─── Create Approval Rule ────────────────────────────────────────────

export async function createApprovalRule(ctx: RlsContext, input: CreateApprovalRuleInput) {
  if (input.approverCount !== 1 && input.approverCount !== 2) {
    throw new ApprovalRuleError('approverCount deve ser 1 ou 2', 400);
  }
  if (input.approverCount === 2 && !input.approver2Id) {
    throw new ApprovalRuleError('approver2Id é obrigatório quando approverCount é 2', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    return tx.approvalRule.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        requestType: input.requestType ?? null,
        ...(input.minAmount !== undefined && { minAmount: input.minAmount }),
        maxAmount: input.maxAmount ?? null,
        approverCount: input.approverCount,
        approver1Id: input.approver1Id,
        approver2Id: input.approver2Id ?? null,
        priority: input.priority,
        active: true,
      },
      include: {
        approver1: { select: { id: true, name: true } },
        approver2: { select: { id: true, name: true } },
      },
    });
  });
}

// ─── List Approval Rules ─────────────────────────────────────────────

export async function listApprovalRules(ctx: RlsContext, options?: { includeInactive?: boolean }) {
  return withRlsContext(ctx, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { organizationId: ctx.organizationId };
    if (!options?.includeInactive) {
      where.active = true;
    }

    return tx.approvalRule.findMany({
      where,
      include: {
        approver1: { select: { id: true, name: true } },
        approver2: { select: { id: true, name: true } },
      },
      orderBy: { priority: 'asc' },
    });
  });
}

// ─── Get Approval Rule By ID ─────────────────────────────────────────

export async function getApprovalRuleById(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const rule = await tx.approvalRule.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        approver1: { select: { id: true, name: true } },
        approver2: { select: { id: true, name: true } },
      },
    });

    if (!rule) {
      throw new ApprovalRuleError('Regra de alçada não encontrada', 404);
    }

    return rule;
  });
}

// ─── Update Approval Rule ────────────────────────────────────────────

export async function updateApprovalRule(
  ctx: RlsContext,
  id: string,
  input: UpdateApprovalRuleInput,
) {
  const approverCount = input.approverCount;
  if (approverCount !== undefined && approverCount !== 1 && approverCount !== 2) {
    throw new ApprovalRuleError('approverCount deve ser 1 ou 2', 400);
  }
  if (approverCount === 2 && input.approver2Id === undefined) {
    throw new ApprovalRuleError('approver2Id é obrigatório quando approverCount é 2', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.approvalRule.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new ApprovalRuleError('Regra de alçada não encontrada', 404);
    }

    return tx.approvalRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.requestType !== undefined && { requestType: input.requestType }),
        ...(input.minAmount !== undefined && { minAmount: input.minAmount }),
        ...(input.maxAmount !== undefined && { maxAmount: input.maxAmount }),
        ...(input.approverCount !== undefined && { approverCount: input.approverCount }),
        ...(input.approver1Id !== undefined && { approver1Id: input.approver1Id }),
        ...(input.approver2Id !== undefined && { approver2Id: input.approver2Id }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.active !== undefined && { active: input.active }),
      },
      include: {
        approver1: { select: { id: true, name: true } },
        approver2: { select: { id: true, name: true } },
      },
    });
  });
}

// ─── Delete Approval Rule ────────────────────────────────────────────

export async function deleteApprovalRule(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.approvalRule.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new ApprovalRuleError('Regra de alçada não encontrada', 404);
    }

    await tx.approvalRule.delete({ where: { id } });
    return { success: true };
  });
}

// ─── Reorder Approval Rules ──────────────────────────────────────────

export async function reorderApprovalRules(ctx: RlsContext, orderedIds: string[]) {
  return withRlsContext(ctx, async (tx) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        tx.approvalRule.updateMany({
          where: { id, organizationId: ctx.organizationId },
          data: { priority: index + 1 },
        }),
      ),
    );
    return { success: true };
  });
}

// ─── Match Approval Rule (used by purchase-requests service) ─────────

export async function matchApprovalRule(
  tx: TxClient,
  organizationId: string,
  requestType: string,
  totalAmount: number,
) {
  const rules = await tx.approvalRule.findMany({
    where: {
      organizationId,
      active: true,
      OR: [{ requestType }, { requestType: null }],
    },
    orderBy: { priority: 'asc' },
  });

  // Filter by amount range (minAmount is Decimal, convert to number for comparison)
  for (const rule of rules) {
    const minOk = Number(rule.minAmount) <= totalAmount;
    const maxOk = rule.maxAmount === null || Number(rule.maxAmount) >= totalAmount;
    if (minOk && maxOk) {
      return rule;
    }
  }

  return null;
}

// ─── Resolve Approver (delegates check) ─────────────────────────────

export async function resolveApprover(
  tx: TxClient,
  primaryApproverId: string,
  organizationId: string,
): Promise<string> {
  const now = new Date();

  const delegation = await tx.delegation.findFirst({
    where: {
      delegatorId: primaryApproverId,
      organizationId,
      active: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  return delegation ? delegation.delegateId : primaryApproverId;
}

// ─── Create Delegation ───────────────────────────────────────────────

export async function createDelegation(
  ctx: RlsContext & { userId: string },
  input: CreateDelegationInput,
) {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const now = new Date();

  if (startDate >= endDate) {
    throw new ApprovalRuleError('A data de início deve ser anterior à data de término', 400);
  }
  if (startDate < new Date(now.getTime() - 60 * 1000)) {
    // allow 1-min buffer
    // No: start date can be past or present
  }

  return withRlsContext(ctx, async (tx) => {
    // Deactivate any existing active delegation for this delegator
    await tx.delegation.updateMany({
      where: {
        delegatorId: ctx.userId,
        organizationId: ctx.organizationId,
        active: true,
      },
      data: { active: false },
    });

    return tx.delegation.create({
      data: {
        organizationId: ctx.organizationId,
        delegatorId: ctx.userId,
        delegateId: input.delegateId,
        startDate,
        endDate,
        notes: input.notes ?? null,
        active: true,
      },
      include: {
        delegate: { select: { id: true, name: true } },
      },
    });
  });
}

// ─── List Delegations ────────────────────────────────────────────────

export async function listDelegations(ctx: RlsContext & { userId: string }) {
  return withRlsContext(ctx, async (tx) => {
    return tx.delegation.findMany({
      where: {
        delegatorId: ctx.userId,
        organizationId: ctx.organizationId,
      },
      include: {
        delegate: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
}

// ─── Deactivate Delegation ───────────────────────────────────────────

export async function deactivateDelegation(ctx: RlsContext & { userId: string }, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.delegation.findFirst({
      where: {
        id,
        delegatorId: ctx.userId,
        organizationId: ctx.organizationId,
      },
    });

    if (!existing) {
      throw new ApprovalRuleError('Delegação não encontrada', 404);
    }

    return tx.delegation.update({
      where: { id },
      data: { active: false },
      include: {
        delegate: { select: { id: true, name: true } },
      },
    });
  });
}
