import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  OperationTypeError,
  MAX_LEVELS,
  DEFAULT_OPERATION_TYPES,
  OPERATION_FIELD_KEYS,
  type CreateOperationTypeInput,
  type UpdateOperationTypeInput,
  type OperationTypeItem,
  type OperationTypeTreeNode,
  type ListOperationTypesQuery,
  type FieldConfig,
  type OperationFieldKey,
} from './operation-types.types';

// ─── Include fragments ─────────────────────────────────────────────

const INCLUDE_BASE = {
  _count: { select: { children: true } },
  crops: { select: { crop: true } },
  fields: {
    select: { fieldKey: true, visibility: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
};

// ─── Helpers ────────────────────────────────────────────────────────

function extractCrops(row: Record<string, unknown>): string[] {
  const crops = row.crops as Array<{ crop: string }> | undefined;
  return crops?.map((c) => c.crop).sort() ?? [];
}

function extractFields(row: Record<string, unknown>): FieldConfig[] {
  const fields = row.fields as
    | Array<{ fieldKey: string; visibility: string; sortOrder: number }>
    | undefined;
  return (
    fields?.map((f) => ({
      fieldKey: f.fieldKey as OperationFieldKey,
      visibility: f.visibility as FieldConfig['visibility'],
      sortOrder: f.sortOrder,
    })) ?? []
  );
}

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
    crops: extractCrops(row),
    fields: extractFields(row),
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

/**
 * Validates that child crops are a subset of parent crops.
 * "Todas" in parent means any crop is allowed for children.
 * If parent has no crops set, child can have any crops.
 */
function validateCropInheritance(childCrops: string[], parentCrops: string[]): void {
  if (parentCrops.length === 0 || parentCrops.includes('Todas')) {
    return; // parent allows everything
  }
  const invalid = childCrops.filter((c) => c !== 'Todas' && !parentCrops.includes(c));
  if (invalid.length > 0) {
    throw new OperationTypeError(
      `Culturas não permitidas pelo nível pai: ${invalid.join(', ')}. ` +
        `Culturas disponíveis: ${parentCrops.join(', ')}`,
      400,
    );
  }
}

function validateFields(fields: FieldConfig[]): void {
  const validKeys = new Set<string>(OPERATION_FIELD_KEYS);
  const seen = new Set<string>();
  for (const f of fields) {
    if (!validKeys.has(f.fieldKey)) {
      throw new OperationTypeError(`Campo desconhecido: ${f.fieldKey}`, 400);
    }
    if (!['required', 'optional', 'hidden'].includes(f.visibility)) {
      throw new OperationTypeError(
        `Visibilidade inválida para ${f.fieldKey}: ${f.visibility}. Use: required, optional, hidden`,
        400,
      );
    }
    if (seen.has(f.fieldKey)) {
      throw new OperationTypeError(`Campo duplicado: ${f.fieldKey}`, 400);
    }
    seen.add(f.fieldKey);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getParentCrops(
  tx: { operationTypeCrop: { findMany: (...args: any[]) => any } },
  parentId: string,
): Promise<string[]> {
  const rows = await tx.operationTypeCrop.findMany({
    where: { operationTypeId: parentId },
    select: { crop: true },
  });
  return (rows as Array<{ crop: string }>).map((r) => r.crop);
}

async function syncCrops(
  tx: {
    operationTypeCrop: { deleteMany: (...args: any[]) => any; createMany: (...args: any[]) => any };
  },
  operationTypeId: string,
  crops: string[],
): Promise<void> {
  await tx.operationTypeCrop.deleteMany({ where: { operationTypeId } });
  if (crops.length > 0) {
    await tx.operationTypeCrop.createMany({
      data: crops.map((crop) => ({ operationTypeId, crop })),
    });
  }
}

async function syncFields(
  tx: {
    operationTypeField: {
      deleteMany: (...args: any[]) => any;
      createMany: (...args: any[]) => any;
    };
  },
  operationTypeId: string,
  fields: FieldConfig[],
): Promise<void> {
  /* eslint-enable @typescript-eslint/no-explicit-any */
  await tx.operationTypeField.deleteMany({ where: { operationTypeId } });
  if (fields.length > 0) {
    await tx.operationTypeField.createMany({
      data: fields.map((f) => ({
        operationTypeId,
        fieldKey: f.fieldKey,
        visibility: f.visibility,
        sortOrder: f.sortOrder,
      })),
    });
  }
}

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createOperationType(
  ctx: RlsContext,
  input: CreateOperationTypeInput,
): Promise<OperationTypeItem> {
  validateInput(input);
  if (input.fields) validateFields(input.fields);

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

      // Validate crop inheritance
      if (input.crops && input.crops.length > 0) {
        const parentCrops = await getParentCrops(tx, input.parentId);
        validateCropInheritance(input.crops, parentCrops);
      }
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
        ...(input.crops && input.crops.length > 0
          ? { crops: { create: input.crops.map((crop) => ({ crop })) } }
          : {}),
        ...(input.fields && input.fields.length > 0
          ? {
              fields: {
                create: input.fields.map((f) => ({
                  fieldKey: f.fieldKey,
                  visibility: f.visibility,
                  sortOrder: f.sortOrder,
                })),
              },
            }
          : {}),
      },
      include: INCLUDE_BASE,
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
    if (query.crop) {
      where.crops = { some: { crop: { in: [query.crop, 'Todas'] } } };
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const rows = await tx.operationType.findMany({
      where: where as any,
      include: INCLUDE_BASE,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return rows.map((r) => toItem(r as unknown as Record<string, unknown>));
  });
}

// ─── GET TREE ───────────────────────────────────────────────────────

export async function getOperationTypeTree(
  ctx: RlsContext,
  options: { includeInactive?: boolean; crop?: string } = {},
): Promise<OperationTypeTreeNode[]> {
  return withRlsContext(ctx, async (tx) => {
    const activeFilter = options.includeInactive ? {} : { isActive: true };
    const deletedFilter = { deletedAt: null };
    const cropFilter = options.crop
      ? { crops: { some: { crop: { in: [options.crop, 'Todas'] } } } }
      : {};

    const roots = await tx.operationType.findMany({
      where: {
        organizationId: ctx.organizationId,
        parentId: null,
        ...deletedFilter,
        ...activeFilter,
      },
      include: {
        ...INCLUDE_BASE,
        children: {
          where: { ...deletedFilter, ...activeFilter, ...cropFilter },
          include: {
            ...INCLUDE_BASE,
            children: {
              where: { ...deletedFilter, ...activeFilter, ...cropFilter },
              include: INCLUDE_BASE,
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // When filtering by crop, exclude root categories with no matching children
    if (options.crop) {
      const filtered = roots
        .map((r) => toTreeNode(r as unknown as Record<string, unknown>))
        .filter((node) => {
          // Keep root if it has matching crops itself or has children after filtering
          const rootCrops = node.crops;
          const hasCrop = rootCrops.includes(options.crop!) || rootCrops.includes('Todas');
          return hasCrop || node.children.length > 0;
        });
      return filtered;
    }

    return roots.map((r) => toTreeNode(r as unknown as Record<string, unknown>));
  });
}

// ─── GET BY ID ──────────────────────────────────────────────────────

export async function getOperationType(ctx: RlsContext, id: string): Promise<OperationTypeItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.operationType.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: INCLUDE_BASE,
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

    // Validate crop inheritance against parent
    if (input.crops !== undefined) {
      const effectiveParentId = input.parentId !== undefined ? input.parentId : existing.parentId;
      if (effectiveParentId && input.crops.length > 0) {
        const parentCrops = await getParentCrops(tx, effectiveParentId);
        validateCropInheritance(input.crops, parentCrops);
      }
      await syncCrops(tx, id, input.crops);
    }

    // Sync field configurations
    if (input.fields !== undefined) {
      validateFields(input.fields);
      await syncFields(tx, id, input.fields);
    }

    const row = await tx.operationType.update({
      where: { id },
      data,
      include: INCLUDE_BASE,
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
      include: INCLUDE_BASE,
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

// ─── SEED DEFAULT OPERATION TYPES ────────────────────────────────────

export async function seedOperationTypes(ctx: RlsContext): Promise<{ created: number }> {
  return withRlsContext(ctx, async (tx) => {
    // Check if org already has operation types
    const existingCount = await tx.operationType.count({
      where: { organizationId: ctx.organizationId, deletedAt: null },
    });
    if (existingCount > 0) {
      throw new OperationTypeError(
        'Organização já possui tipos de operação cadastrados. O carregamento padrão só pode ser feito em organizações sem cadastros existentes.',
        409,
      );
    }

    let created = 0;

    for (const category of DEFAULT_OPERATION_TYPES) {
      const parent = await tx.operationType.create({
        data: {
          organizationId: ctx.organizationId,
          name: category.name,
          level: 1,
          sortOrder: category.sortOrder,
          isSystem: true,
          crops: { create: category.crops.map((crop) => ({ crop })) },
        },
      });
      created++;

      for (const child of category.children) {
        const level2 = await tx.operationType.create({
          data: {
            organizationId: ctx.organizationId,
            name: child.name,
            parentId: parent.id,
            level: 2,
            sortOrder: child.sortOrder,
            isSystem: true,
            crops: { create: child.crops.map((crop) => ({ crop })) },
          },
        });
        created++;

        if (child.children) {
          for (const grandchild of child.children) {
            await tx.operationType.create({
              data: {
                organizationId: ctx.organizationId,
                name: grandchild.name,
                parentId: level2.id,
                level: 3,
                sortOrder: grandchild.sortOrder,
                isSystem: true,
                crops: { create: grandchild.crops.map((crop) => ({ crop })) },
              },
            });
            created++;
          }
        }
      }
    }

    return { created };
  });
}
