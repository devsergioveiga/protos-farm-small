import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  OperationTypeError,
  MAX_LEVELS,
  type CreateOperationTypeInput,
  type UpdateOperationTypeInput,
  type OperationTypeItem,
  type OperationTypeTreeNode,
  type ListOperationTypesQuery,
} from './operation-types.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toItem(row: Record<string, unknown>): OperationTypeItem {
  const children = row._count as { children: number } | undefined;
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    parentId: (row.parentId as string) ?? null,
    level: row.level as number,
    sortOrder: row.sortOrder as number,
    isSystem: row.isSystem as boolean,
    isActive: row.isActive as boolean,
    childCount: children?.children ?? 0,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toTreeNode(row: Record<string, unknown>): OperationTypeTreeNode {
  const rawChildren = (row.children as Record<string, unknown>[]) ?? [];
  return {
    ...toItem(row),
    children: rawChildren.map(toTreeNode),
  };
}

function validateInput(input: CreateOperationTypeInput): void {
  if (!input.name?.trim()) {
    throw new OperationTypeError('Nome do tipo de operação é obrigatório', 400);
  }
  if (input.name.trim().length > 200) {
    throw new OperationTypeError('Nome não pode ter mais de 200 caracteres', 400);
  }
}

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createOperationType(
  ctx: RlsContext,
  input: CreateOperationTypeInput,
): Promise<OperationTypeItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    let level = 1;

    if (input.parentId) {
      const parent = await tx.operationType.findFirst({
        where: {
          id: input.parentId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true, level: true },
      });
      if (!parent) {
        throw new OperationTypeError('Tipo de operação pai não encontrado', 404);
      }
      if (parent.level >= MAX_LEVELS) {
        throw new OperationTypeError(`Máximo de ${MAX_LEVELS} níveis hierárquicos permitidos`, 400);
      }
      level = parent.level + 1;
    }

    const existing = await tx.operationType.findFirst({
      where: {
        name: input.name.trim(),
        parentId: input.parentId ?? null,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new OperationTypeError('Já existe um tipo de operação com este nome neste nível', 409);
    }

    const row = await tx.operationType.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        parentId: input.parentId ?? null,
        level,
        sortOrder: input.sortOrder ?? 0,
      },
      include: { _count: { select: { children: true } } },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listOperationTypes(
  ctx: RlsContext,
  query: ListOperationTypesQuery = {},
): Promise<OperationTypeItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };

    if (query.parentId !== undefined) {
      where.parentId = query.parentId;
    }
    if (query.level != null) {
      where.level = query.level;
    }
    if (!query.includeInactive) {
      where.isActive = true;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const rows = await tx.operationType.findMany({
      where: where as any,
      include: { _count: { select: { children: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return rows.map((r) => toItem(r as unknown as Record<string, unknown>));
  });
}

// ─── GET TREE ───────────────────────────────────────────────────────

export async function getOperationTypeTree(
  ctx: RlsContext,
  options: { includeInactive?: boolean } = {},
): Promise<OperationTypeTreeNode[]> {
  return withRlsContext(ctx, async (tx) => {
    const activeFilter = options.includeInactive ? {} : { isActive: true };
    const deletedFilter = { deletedAt: null };

    const roots = await tx.operationType.findMany({
      where: {
        organizationId: ctx.organizationId,
        parentId: null,
        ...deletedFilter,
        ...activeFilter,
      },
      include: {
        _count: { select: { children: true } },
        children: {
          where: { ...deletedFilter, ...activeFilter },
          include: {
            _count: { select: { children: true } },
            children: {
              where: { ...deletedFilter, ...activeFilter },
              include: { _count: { select: { children: true } } },
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return roots.map((r) => toTreeNode(r as unknown as Record<string, unknown>));
  });
}

// ─── GET BY ID ──────────────────────────────────────────────────────

export async function getOperationType(ctx: RlsContext, id: string): Promise<OperationTypeItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.operationType.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: { _count: { select: { children: true } } },
    });
    if (!row) {
      throw new OperationTypeError('Tipo de operação não encontrado', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateOperationType(
  ctx: RlsContext,
  id: string,
  input: UpdateOperationTypeInput,
): Promise<OperationTypeItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.operationType.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, isSystem: true, parentId: true, level: true },
    });
    if (!existing) {
      throw new OperationTypeError('Tipo de operação não encontrado', 404);
    }

    const data: Record<string, unknown> = {};

    if (input.name !== undefined) {
      if (!input.name?.trim()) {
        throw new OperationTypeError('Nome do tipo de operação é obrigatório', 400);
      }
      const targetParentId = input.parentId !== undefined ? input.parentId : existing.parentId;
      const duplicate = await tx.operationType.findFirst({
        where: {
          name: input.name.trim(),
          parentId: targetParentId ?? null,
          organizationId: ctx.organizationId,
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new OperationTypeError(
          'Já existe um tipo de operação com este nome neste nível',
          409,
        );
      }
      data.name = input.name.trim();
    }

    if (input.description !== undefined) {
      data.description = input.description?.trim() ?? null;
    }

    if (input.sortOrder !== undefined) {
      data.sortOrder = input.sortOrder;
    }

    if (input.parentId !== undefined) {
      if (input.parentId === id) {
        throw new OperationTypeError('Tipo de operação não pode ser pai de si mesmo', 400);
      }
      if (input.parentId) {
        const parent = await tx.operationType.findFirst({
          where: {
            id: input.parentId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          select: { id: true, level: true },
        });
        if (!parent) {
          throw new OperationTypeError('Tipo de operação pai não encontrado', 404);
        }
        if (parent.level >= MAX_LEVELS) {
          throw new OperationTypeError(
            `Máximo de ${MAX_LEVELS} níveis hierárquicos permitidos`,
            400,
          );
        }
        data.parentId = input.parentId;
        data.level = parent.level + 1;
      } else {
        data.parentId = null;
        data.level = 1;
      }
    }

    const row = await tx.operationType.update({
      where: { id },
      data,
      include: { _count: { select: { children: true } } },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── TOGGLE ACTIVE ──────────────────────────────────────────────────

export async function toggleOperationTypeActive(
  ctx: RlsContext,
  id: string,
): Promise<OperationTypeItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.operationType.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, isActive: true },
    });
    if (!existing) {
      throw new OperationTypeError('Tipo de operação não encontrado', 404);
    }

    const row = await tx.operationType.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: { _count: { select: { children: true } } },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE (soft) ──────────────────────────────────────────────────

export async function deleteOperationType(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.operationType.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        _count: {
          select: { children: { where: { deletedAt: null } } },
        },
      },
    });
    if (!existing) {
      throw new OperationTypeError('Tipo de operação não encontrado', 404);
    }

    const childCount = (existing as unknown as Record<string, { children: number }>)._count
      .children;
    if (childCount > 0) {
      throw new OperationTypeError(
        'Não é possível excluir: existem sub-operações vinculadas. Remova-as primeiro.',
        400,
      );
    }

    await tx.operationType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}
