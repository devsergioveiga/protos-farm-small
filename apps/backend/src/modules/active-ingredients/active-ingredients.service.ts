import { withRlsContext, type RlsContext } from '../../database/rls';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ActiveIngredientItem {
  id: string;
  name: string;
  type: string;
  casNumber: string | null;
  notes: string | null;
}

export interface CreateActiveIngredientInput {
  name: string;
  type?: string;
}

export async function listActiveIngredients(ctx: RlsContext): Promise<ActiveIngredientItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await (tx as any).activeIngredient.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        casNumber: true,
        notes: true,
      },
    });
    return rows;
  });
}

export async function createActiveIngredient(
  ctx: RlsContext,
  input: CreateActiveIngredientInput,
): Promise<ActiveIngredientItem> {
  const name = input.name?.trim();
  if (!name) {
    throw Object.assign(new Error('Nome do princípio ativo é obrigatório'), { statusCode: 400 });
  }

  return withRlsContext(ctx, async (tx) => {
    // Check for duplicate
    const existing = await (tx as any).activeIngredient.findFirst({
      where: { organizationId: ctx.organizationId, name },
    });
    if (existing) {
      throw Object.assign(new Error('Princípio ativo já cadastrado'), { statusCode: 409 });
    }

    const row = await (tx as any).activeIngredient.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        type: input.type || 'VETERINARY',
      },
      select: {
        id: true,
        name: true,
        type: true,
        casNumber: true,
        notes: true,
      },
    });
    return row;
  });
}

export async function updateActiveIngredient(
  ctx: RlsContext,
  id: string,
  input: CreateActiveIngredientInput,
): Promise<ActiveIngredientItem> {
  const name = input.name?.trim();
  if (!name) {
    throw Object.assign(new Error('Nome do princípio ativo é obrigatório'), { statusCode: 400 });
  }

  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).activeIngredient.update({
      where: { id },
      data: { name, type: input.type || undefined },
      select: { id: true, name: true, type: true, casNumber: true, notes: true },
    });
    return row;
  });
}

export async function deleteActiveIngredient(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    await (tx as any).activeIngredient.delete({ where: { id } });
  });
}
