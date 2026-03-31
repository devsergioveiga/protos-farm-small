import { withRlsContext, type RlsContext } from '../../database/rls';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ProductClassItem {
  id: string;
  name: string;
  description: string | null;
}

export interface CreateProductClassInput {
  name: string;
  description?: string;
}

export interface UpdateProductClassInput {
  name?: string;
  description?: string | null;
}

export async function listProductClasses(
  ctx: RlsContext,
  search?: string,
): Promise<ProductClassItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { organizationId: ctx.organizationId };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    const rows = await (tx as any).productClass.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    return rows;
  });
}

export async function createProductClass(
  ctx: RlsContext,
  input: CreateProductClassInput,
): Promise<ProductClassItem> {
  const name = input.name?.trim();
  if (!name) {
    throw Object.assign(new Error('Nome da classe de produto é obrigatório'), { statusCode: 400 });
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).productClass.findFirst({
      where: { organizationId: ctx.organizationId, name },
    });
    if (existing) {
      throw Object.assign(new Error('Classe de produto já cadastrada'), { statusCode: 409 });
    }

    const row = await (tx as any).productClass.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        description: input.description?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    return row;
  });
}

export async function updateProductClass(
  ctx: RlsContext,
  id: string,
  input: UpdateProductClassInput,
): Promise<ProductClassItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).productClass.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw Object.assign(new Error('Classe de produto não encontrada'), { statusCode: 404 });
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw Object.assign(new Error('Nome da classe de produto é obrigatório'), {
          statusCode: 400,
        });
      }
      // Check duplicate
      const dup = await (tx as any).productClass.findFirst({
        where: { organizationId: ctx.organizationId, name, id: { not: id } },
      });
      if (dup) {
        throw Object.assign(new Error('Classe de produto já cadastrada'), { statusCode: 409 });
      }
      data.name = name;
    }
    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }

    const row = await (tx as any).productClass.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    return row;
  });
}

export async function deleteProductClass(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).productClass.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw Object.assign(new Error('Classe de produto não encontrada'), { statusCode: 404 });
    }

    // Unlink products before deleting
    await (tx as any).product.updateMany({
      where: { productClassId: id },
      data: { productClassId: null },
    });

    await (tx as any).productClass.delete({ where: { id } });
  });
}
