import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  EpiProductError,
  type CreateEpiProductInput,
  type UpdateEpiProductInput,
  type EpiProductOutput,
  type CreatePositionEpiRequirementInput,
  type PositionEpiRequirementOutput,
} from './epi-products.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function toNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'toNumber' in val)
    return (val as { toNumber(): number }).toNumber();
  return Number(val);
}

function mapEpiProduct(row: any): EpiProductOutput {
  const balance = row.product?.stockBalances?.[0];
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product?.name ?? '',
    caNumber: row.caNumber,
    caExpiry: row.caExpiry ? (row.caExpiry as Date).toISOString() : null,
    epiType: row.epiType,
    currentStock: balance ? toNumber(balance.currentQuantity) : 0,
    organizationId: row.organizationId,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ─── EPI Product CRUD ────────────────────────────────────────────────

export async function createEpiProduct(
  ctx: RlsContext,
  input: CreateEpiProductInput,
): Promise<EpiProductOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Verify product exists and belongs to org
    const product = await (tx as any).product.findFirst({
      where: { id: input.productId, organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    if (!product) {
      throw new EpiProductError('Produto não encontrado', 'PRODUCT_NOT_FOUND');
    }

    const existing = await (tx as any).epiProduct.findUnique({
      where: { productId: input.productId },
    });
    if (existing) {
      throw new EpiProductError('Este produto já está cadastrado como EPI', 'ALREADY_EXISTS');
    }

    const row = await (tx as any).epiProduct.create({
      data: {
        organizationId: ctx.organizationId,
        productId: input.productId,
        caNumber: input.caNumber,
        caExpiry: input.caExpiry ? new Date(input.caExpiry) : null,
        epiType: input.epiType,
      },
      include: {
        product: {
          select: {
            name: true,
            stockBalances: { select: { currentQuantity: true } },
          },
        },
      },
    });

    return mapEpiProduct(row);
  });
}

export async function updateEpiProduct(
  ctx: RlsContext,
  id: string,
  input: UpdateEpiProductInput,
): Promise<EpiProductOutput> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).epiProduct.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new EpiProductError('EPI não encontrado', 'NOT_FOUND');
    }

    const row = await (tx as any).epiProduct.update({
      where: { id },
      data: {
        ...(input.caNumber !== undefined && { caNumber: input.caNumber }),
        ...(input.caExpiry !== undefined && {
          caExpiry: input.caExpiry ? new Date(input.caExpiry) : null,
        }),
        ...(input.epiType !== undefined && { epiType: input.epiType }),
      },
      include: {
        product: {
          select: {
            name: true,
            stockBalances: { select: { currentQuantity: true } },
          },
        },
      },
    });

    return mapEpiProduct(row);
  });
}

export async function deleteEpiProduct(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).epiProduct.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { deliveries: { take: 1 } },
    });
    if (!existing) {
      throw new EpiProductError('EPI não encontrado', 'NOT_FOUND');
    }
    if (existing.deliveries.length > 0) {
      throw new EpiProductError(
        'Não é possível excluir um EPI com entregas registradas',
        'HAS_DELIVERIES',
      );
    }

    await (tx as any).epiProduct.delete({ where: { id } });
  });
}

export async function listEpiProducts(
  ctx: RlsContext,
  query?: { search?: string; epiType?: string; page?: number; limit?: number },
): Promise<{ data: EpiProductOutput[]; total: number; page: number; limit: number }> {
  return withRlsContext(ctx, async (tx) => {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { organizationId: ctx.organizationId };
    if (query?.epiType) where.epiType = query.epiType;
    if (query?.search) {
      where.product = { name: { contains: query.search, mode: 'insensitive' } };
    }

    const [rows, total] = await Promise.all([
      (tx as any).epiProduct.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              name: true,
              stockBalances: { select: { currentQuantity: true } },
            },
          },
        },
      }),
      (tx as any).epiProduct.count({ where }),
    ]);

    return {
      data: rows.map(mapEpiProduct),
      total,
      page,
      limit,
    };
  });
}

export async function getEpiProduct(ctx: RlsContext, id: string): Promise<EpiProductOutput> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).epiProduct.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        product: {
          select: {
            name: true,
            stockBalances: { select: { currentQuantity: true } },
          },
        },
      },
    });
    if (!row) {
      throw new EpiProductError('EPI não encontrado', 'NOT_FOUND');
    }
    return mapEpiProduct(row);
  });
}

// ─── Position EPI Requirements ───────────────────────────────────────

export async function createPositionEpiRequirement(
  ctx: RlsContext,
  input: CreatePositionEpiRequirementInput,
): Promise<PositionEpiRequirementOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Verify position exists
    const position = await (tx as any).position.findFirst({
      where: { id: input.positionId, organizationId: ctx.organizationId },
      select: { id: true, title: true },
    });
    if (!position) {
      throw new EpiProductError('Cargo não encontrado', 'POSITION_NOT_FOUND');
    }

    // Verify epiProduct exists and belongs to org
    const epiProduct = await (tx as any).epiProduct.findFirst({
      where: { id: input.epiProductId, organizationId: ctx.organizationId },
      include: { product: { select: { name: true } } },
    });
    if (!epiProduct) {
      throw new EpiProductError('EPI não encontrado', 'EPI_NOT_FOUND');
    }

    // Check for duplicate
    const existing = await (tx as any).positionEpiRequirement.findUnique({
      where: {
        positionId_epiProductId: {
          positionId: input.positionId,
          epiProductId: input.epiProductId,
        },
      },
    });
    if (existing) {
      throw new EpiProductError('Este EPI já está configurado para este cargo', 'ALREADY_EXISTS');
    }

    const row = await (tx as any).positionEpiRequirement.create({
      data: {
        organizationId: ctx.organizationId,
        positionId: input.positionId,
        epiProductId: input.epiProductId,
        quantity: input.quantity ?? 1,
      },
    });

    return {
      id: row.id,
      positionId: row.positionId,
      positionName: position.title,
      epiProductId: row.epiProductId,
      epiProductName: epiProduct.product.name,
      quantity: row.quantity,
    };
  });
}

export async function deletePositionEpiRequirement(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).positionEpiRequirement.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new EpiProductError('Requisito não encontrado', 'NOT_FOUND');
    }

    await (tx as any).positionEpiRequirement.delete({ where: { id } });
  });
}

export async function listPositionEpiRequirements(
  ctx: RlsContext,
  positionId?: string,
): Promise<PositionEpiRequirementOutput[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { organizationId: ctx.organizationId };
    if (positionId) where.positionId = positionId;

    const rows = await (tx as any).positionEpiRequirement.findMany({
      where,
      include: {
        position: { select: { title: true } },
        epiProduct: {
          include: { product: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row: any) => ({
      id: row.id,
      positionId: row.positionId,
      positionName: row.position.title,
      epiProductId: row.epiProductId,
      epiProductName: row.epiProduct.product.name,
      quantity: row.quantity,
    }));
  });
}
