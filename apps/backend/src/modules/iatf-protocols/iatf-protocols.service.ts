import type { IatfProtocolStatus } from '@prisma/client';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  IatfProtocolError,
  TARGET_CATEGORIES,
  TARGET_CATEGORY_LABELS,
  IATF_PROTOCOL_STATUSES,
  IATF_PROTOCOL_STATUS_LABELS,
  DOSE_UNITS,
  DOSE_UNIT_LABELS,
  ADMIN_ROUTES,
  ADMIN_ROUTE_LABELS,
  SEED_IATF_PROTOCOLS,
  type CreateProtocolInput,
  type UpdateProtocolInput,
  type ListProtocolsQuery,
  type IatfProtocolItem,
  type StepItem,
  type StepProductItem,
} from './iatf-protocols.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toStepProductItem(row: Record<string, unknown>): StepProductItem {
  const doseUnit = row.doseUnit as string;
  const adminRoute = (row.administrationRoute as string) ?? null;
  return {
    id: row.id as string,
    productId: (row.productId as string) ?? null,
    productName: row.productName as string,
    dose: row.dose as number,
    doseUnit,
    doseUnitLabel: DOSE_UNIT_LABELS[doseUnit] ?? doseUnit,
    administrationRoute: adminRoute,
    administrationRouteLabel: adminRoute ? (ADMIN_ROUTE_LABELS[adminRoute] ?? adminRoute) : null,
    notes: (row.notes as string) ?? null,
  };
}

function toStepItem(row: Record<string, unknown>): StepItem {
  const dayNumber = row.dayNumber as number;
  const products = (row.products as Record<string, unknown>[]) ?? [];
  return {
    id: row.id as string,
    dayNumber,
    dayLabel: `D${dayNumber}`,
    description: row.description as string,
    isAiDay: row.isAiDay as boolean,
    sortOrder: row.sortOrder as number,
    products: products.map((p) => toStepProductItem(p)),
  };
}

function toItem(row: Record<string, unknown>): IatfProtocolItem {
  const targetCategory = row.targetCategory as string;
  const status = row.status as string;
  const steps = (row.steps as Record<string, unknown>[]) ?? [];

  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    targetCategory,
    targetCategoryLabel: TARGET_CATEGORY_LABELS[targetCategory] ?? targetCategory,
    veterinaryAuthor: (row.veterinaryAuthor as string) ?? null,
    status,
    statusLabel: IATF_PROTOCOL_STATUS_LABELS[status] ?? status,
    version: row.version as number,
    parentId: (row.parentId as string) ?? null,
    estimatedCostCents: (row.estimatedCostCents as number) ?? 0,
    notes: (row.notes as string) ?? null,
    createdBy: row.createdBy as string,
    steps: steps
      .map((s) => toStepItem(s))
      .sort((a, b) => a.dayNumber - b.dayNumber || a.sortOrder - b.sortOrder),
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function validateInput(input: CreateProtocolInput, isUpdate = false): void {
  if (!isUpdate) {
    if (!input.name?.trim()) {
      throw new IatfProtocolError('Nome do protocolo é obrigatório', 400);
    }
    if (!input.targetCategory) {
      throw new IatfProtocolError('Categoria alvo é obrigatória', 400);
    }
    if (!input.steps || input.steps.length === 0) {
      throw new IatfProtocolError('O protocolo deve ter pelo menos uma etapa', 400);
    }
  }

  if (input.targetCategory !== undefined) {
    if (!TARGET_CATEGORIES.includes(input.targetCategory as (typeof TARGET_CATEGORIES)[number])) {
      throw new IatfProtocolError(
        `Categoria alvo inválida. Use: ${TARGET_CATEGORIES.join(', ')}`,
        400,
      );
    }
  }

  if (input.status !== undefined) {
    if (!IATF_PROTOCOL_STATUSES.includes(input.status as (typeof IATF_PROTOCOL_STATUSES)[number])) {
      throw new IatfProtocolError(
        `Status inválido. Use: ${IATF_PROTOCOL_STATUSES.join(', ')}`,
        400,
      );
    }
  }

  if (input.steps) {
    for (const step of input.steps) {
      if (!step.description?.trim()) {
        throw new IatfProtocolError('Descrição da etapa é obrigatória', 400);
      }
      if (step.dayNumber == null || step.dayNumber < 0) {
        throw new IatfProtocolError('Dia da etapa deve ser um número não negativo', 400);
      }
      // Filter out empty product entries (no name = not a real product)
      const realProducts = (step.products ?? []).filter((p) => p.productName?.trim());
      if (realProducts.length > 0) {
        for (const prod of realProducts) {
          if (prod.dose == null || prod.dose <= 0) {
            throw new IatfProtocolError('Dose deve ser um número positivo', 400);
          }
          if (!DOSE_UNITS.includes(prod.doseUnit as (typeof DOSE_UNITS)[number])) {
            throw new IatfProtocolError(
              `Unidade de dose inválida. Use: ${DOSE_UNITS.join(', ')}`,
              400,
            );
          }
          if (
            prod.administrationRoute !== undefined &&
            prod.administrationRoute !== null &&
            !ADMIN_ROUTES.includes(prod.administrationRoute as (typeof ADMIN_ROUTES)[number])
          ) {
            throw new IatfProtocolError(
              `Via de administração inválida. Use: ${ADMIN_ROUTES.join(', ')}`,
              400,
            );
          }
        }
      }
    }
  }
}

const INCLUDE_RELATIONS = {
  steps: {
    include: {
      products: true,
    },
    orderBy: [{ dayNumber: 'asc' as const }, { sortOrder: 'asc' as const }],
  },
};

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createProtocol(
  ctx: RlsContext,
  userId: string,
  input: CreateProtocolInput,
): Promise<IatfProtocolItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Check duplicate name
    const existing = await tx.iatfProtocol.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        deletedAt: null,
      },
    });
    if (existing) {
      throw new IatfProtocolError('Já existe um protocolo IATF com esse nome', 409);
    }

    const row = await tx.iatfProtocol.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        targetCategory: input.targetCategory,
        veterinaryAuthor: input.veterinaryAuthor?.trim() || null,
        status: (input.status as IatfProtocolStatus) || 'ACTIVE',
        notes: input.notes?.trim() || null,
        createdBy: userId,
        steps: {
          create: input.steps.map((step, idx) => ({
            dayNumber: step.dayNumber,
            description: step.description.trim(),
            isAiDay: step.isAiDay ?? false,
            sortOrder: step.sortOrder ?? idx,
            products: {
              create: (step.products ?? [])
                .filter((p) => p.productName?.trim())
                .map((prod) => ({
                  productId: prod.productId || null,
                  productName: prod.productName.trim(),
                  dose: prod.dose,
                  doseUnit: prod.doseUnit,
                  administrationRoute: prod.administrationRoute || null,
                  notes: prod.notes?.trim() || null,
                })),
            },
          })),
        },
      },
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listProtocols(
  ctx: RlsContext,
  query: ListProtocolsQuery,
): Promise<{
  data: IatfProtocolItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.targetCategory) {
      where.targetCategory = query.targetCategory;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { veterinaryAuthor: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const [rows, total] = await Promise.all([
      tx.iatfProtocol.findMany({
        where,
        include: INCLUDE_RELATIONS,
        orderBy: [{ name: 'asc' }, { version: 'desc' }],
        skip,
        take: limit,
      }),
      tx.iatfProtocol.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toItem(r as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getProtocol(ctx: RlsContext, protocolId: string): Promise<IatfProtocolItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.iatfProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!row) {
      throw new IatfProtocolError('Protocolo IATF não encontrado', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE (with versioning — CA7) ────────────────────────────────

export async function updateProtocol(
  ctx: RlsContext,
  protocolId: string,
  userId: string,
  input: UpdateProtocolInput,
): Promise<IatfProtocolItem> {
  validateInput(input as CreateProtocolInput, true);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.iatfProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!existing) {
      throw new IatfProtocolError('Protocolo IATF não encontrado', 404);
    }

    const newName = input.name !== undefined ? input.name.trim() : existing.name;

    // Check for duplicate name if name changed
    if (input.name !== undefined && input.name.trim() !== existing.name) {
      const duplicate = await tx.iatfProtocol.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: newName,
          deletedAt: null,
          id: { not: protocolId },
        },
      });
      if (duplicate) {
        throw new IatfProtocolError('Já existe um protocolo IATF com esse nome', 409);
      }
    }

    // If steps are being updated
    const hasStepsChange = input.steps !== undefined;
    if (hasStepsChange) {
      const steps = input.steps!;
      const wantsNewVersion = input.createNewVersion !== false; // default true

      if (wantsNewVersion) {
        // ─── New version (CA7) ────────────────────────────
        const parentId = existing.parentId ?? existing.id;
        const latestVersion = await tx.iatfProtocol.findFirst({
          where: {
            OR: [
              { id: parentId, organizationId: ctx.organizationId },
              { parentId, organizationId: ctx.organizationId },
            ],
            deletedAt: null,
          },
          orderBy: { version: 'desc' },
        });
        const newVersion = (latestVersion?.version ?? existing.version) + 1;

        // Deactivate all previous versions
        await tx.iatfProtocol.updateMany({
          where: {
            OR: [{ id: parentId }, { parentId }],
            organizationId: ctx.organizationId,
            status: 'ACTIVE',
          },
          data: { status: 'INACTIVE' as IatfProtocolStatus },
        });

        const newRow = await tx.iatfProtocol.create({
          data: {
            organizationId: ctx.organizationId,
            name: newName,
            description:
              input.description !== undefined
                ? input.description?.trim() || null
                : existing.description,
            targetCategory:
              input.targetCategory !== undefined ? input.targetCategory : existing.targetCategory,
            veterinaryAuthor:
              input.veterinaryAuthor !== undefined
                ? input.veterinaryAuthor?.trim() || null
                : existing.veterinaryAuthor,
            status:
              input.status !== undefined ? (input.status as IatfProtocolStatus) : existing.status,
            notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
            version: newVersion,
            parentId,
            createdBy: userId,
            steps: {
              create: steps.map((step, idx) => ({
                dayNumber: step.dayNumber,
                description: step.description.trim(),
                isAiDay: step.isAiDay ?? false,
                sortOrder: step.sortOrder ?? idx,
                products: {
                  create: (step.products ?? [])
                    .filter((p) => p.productName?.trim())
                    .map((prod) => ({
                      productId: prod.productId || null,
                      productName: prod.productName.trim(),
                      dose: prod.dose,
                      doseUnit: prod.doseUnit,
                      administrationRoute: prod.administrationRoute || null,
                      notes: prod.notes?.trim() || null,
                    })),
                },
              })),
            },
          },
          include: INCLUDE_RELATIONS,
        });

        return toItem(newRow as unknown as Record<string, unknown>);
      }

      // ─── In-place correction (no new version) ──────────
      // Delete existing steps (cascade deletes products)
      const existingSteps = await tx.iatfProtocolStep.findMany({
        where: { protocolId },
        select: { id: true },
      });
      for (const s of existingSteps) {
        await tx.iatfProtocolStepProduct.deleteMany({ where: { stepId: s.id } });
      }
      await tx.iatfProtocolStep.deleteMany({ where: { protocolId } });

      // Recreate steps with updated data
      for (let idx = 0; idx < steps.length; idx++) {
        const step = steps[idx];
        await tx.iatfProtocolStep.create({
          data: {
            protocolId,
            dayNumber: step.dayNumber,
            description: step.description.trim(),
            isAiDay: step.isAiDay ?? false,
            sortOrder: step.sortOrder ?? idx,
            products: {
              create: (step.products ?? [])
                .filter((p) => p.productName?.trim())
                .map((prod) => ({
                  productId: prod.productId || null,
                  productName: prod.productName.trim(),
                  dose: prod.dose,
                  doseUnit: prod.doseUnit,
                  administrationRoute: prod.administrationRoute || null,
                  notes: prod.notes?.trim() || null,
                })),
            },
          },
        });
      }

      // Update protocol metadata fields if provided
      const metaData: Record<string, unknown> = {};
      if (input.name !== undefined) metaData.name = newName;
      if (input.description !== undefined) metaData.description = input.description?.trim() || null;
      if (input.targetCategory !== undefined) metaData.targetCategory = input.targetCategory;
      if (input.veterinaryAuthor !== undefined)
        metaData.veterinaryAuthor = input.veterinaryAuthor?.trim() || null;
      if (input.status !== undefined) metaData.status = input.status as IatfProtocolStatus;
      if (input.notes !== undefined) metaData.notes = input.notes?.trim() || null;

      if (Object.keys(metaData).length > 0) {
        await tx.iatfProtocol.update({
          where: { id: protocolId },
          data: metaData,
        });
      }

      const updatedRow = await tx.iatfProtocol.findUniqueOrThrow({
        where: { id: protocolId },
        include: INCLUDE_RELATIONS,
      });

      return toItem(updatedRow as unknown as Record<string, unknown>);
    }

    // Simple update (no step change, no new version)
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = newName;
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.targetCategory !== undefined) data.targetCategory = input.targetCategory;
    if (input.veterinaryAuthor !== undefined)
      data.veterinaryAuthor = input.veterinaryAuthor?.trim() || null;
    if (input.status !== undefined) data.status = input.status as IatfProtocolStatus;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const row = await tx.iatfProtocol.update({
      where: { id: protocolId },
      data,
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteProtocol(ctx: RlsContext, protocolId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.iatfProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new IatfProtocolError('Protocolo IATF não encontrado', 404);
    }

    await tx.iatfProtocol.update({
      where: { id: protocolId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── DUPLICATE (CA5) ───────────────────────────────────────────────

export async function duplicateProtocol(
  ctx: RlsContext,
  protocolId: string,
  userId: string,
  newName?: string,
): Promise<IatfProtocolItem> {
  return withRlsContext(ctx, async (tx) => {
    const source = await tx.iatfProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!source) {
      throw new IatfProtocolError('Protocolo IATF não encontrado', 404);
    }

    // Find unique name
    let copyName = newName?.trim() || `${source.name} (cópia)`;
    let counter = 2;
    while (true) {
      const dup = await tx.iatfProtocol.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: copyName,
          deletedAt: null,
        },
      });
      if (!dup) break;
      copyName = newName?.trim()
        ? `${newName.trim()} (${counter})`
        : `${source.name} (cópia ${counter})`;
      counter++;
    }

    const steps = (source as unknown as Record<string, unknown>).steps as Array<
      Record<string, unknown>
    >;

    const row = await tx.iatfProtocol.create({
      data: {
        organizationId: ctx.organizationId,
        name: copyName,
        description: source.description,
        targetCategory: source.targetCategory,
        veterinaryAuthor: source.veterinaryAuthor,
        status: 'ACTIVE' as IatfProtocolStatus,
        notes: source.notes,
        createdBy: userId,
        steps: {
          create: steps.map((s) => ({
            dayNumber: s.dayNumber as number,
            description: s.description as string,
            isAiDay: s.isAiDay as boolean,
            sortOrder: s.sortOrder as number,
            products: {
              create: ((s.products as Array<Record<string, unknown>>) ?? []).map((p) => ({
                productId: (p.productId as string) || null,
                productName: p.productName as string,
                dose: p.dose as number,
                doseUnit: p.doseUnit as string,
                administrationRoute: (p.administrationRoute as string) || null,
                notes: (p.notes as string) ?? null,
              })),
            },
          })),
        },
      },
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── CALCULATE ESTIMATED COST (CA6) ────────────────────────────────

export async function calculateEstimatedCost(
  ctx: RlsContext,
  protocolId: string,
): Promise<{
  estimatedCostCents: number;
  details: Array<{
    productName: string;
    dose: number;
    doseUnit: string;
    unitCostCents: number;
    totalCostCents: number;
  }>;
}> {
  return withRlsContext(ctx, async (tx) => {
    const protocol = await tx.iatfProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!protocol) {
      throw new IatfProtocolError('Protocolo IATF não encontrado', 404);
    }

    const steps = (protocol as unknown as Record<string, unknown>).steps as Array<
      Record<string, unknown>
    >;

    // Collect all product IDs
    const productIds: string[] = [];
    for (const step of steps) {
      const prods = (step.products as Array<Record<string, unknown>>) ?? [];
      for (const prod of prods) {
        if (prod.productId) {
          productIds.push(prod.productId as string);
        }
      }
    }

    // Fetch stock balances for average costs
    const balances =
      productIds.length > 0
        ? await tx.stockBalance.findMany({
            where: {
              organizationId: ctx.organizationId,
              productId: { in: productIds },
            },
          })
        : [];

    const costMap = new Map<string, number>();
    for (const balance of balances) {
      costMap.set(balance.productId, Number(balance.averageCost) * 100); // convert to cents
    }

    let totalCostCents = 0;
    const details: Array<{
      productName: string;
      dose: number;
      doseUnit: string;
      unitCostCents: number;
      totalCostCents: number;
    }> = [];

    for (const step of steps) {
      const prods = (step.products as Array<Record<string, unknown>>) ?? [];
      for (const prod of prods) {
        const productId = prod.productId as string | null;
        const unitCostCents = productId ? (costMap.get(productId) ?? 0) : 0;
        const dose = prod.dose as number;
        const itemCost = Math.round(unitCostCents * dose);

        details.push({
          productName: prod.productName as string,
          dose,
          doseUnit: prod.doseUnit as string,
          unitCostCents: Math.round(unitCostCents),
          totalCostCents: itemCost,
        });

        totalCostCents += itemCost;
      }
    }

    // Update protocol with estimated cost
    await tx.iatfProtocol.update({
      where: { id: protocolId },
      data: { estimatedCostCents: totalCostCents },
    });

    return { estimatedCostCents: totalCostCents, details };
  });
}

// ─── VERSION HISTORY (CA7) ─────────────────────────────────────────

export async function listVersions(
  ctx: RlsContext,
  protocolId: string,
): Promise<IatfProtocolItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const protocol = await tx.iatfProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!protocol) {
      throw new IatfProtocolError('Protocolo IATF não encontrado', 404);
    }

    const parentId = protocol.parentId ?? protocol.id;

    const versions = await tx.iatfProtocol.findMany({
      where: {
        OR: [{ id: parentId }, { parentId }],
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
      orderBy: { version: 'desc' },
    });

    return versions.map((r: unknown) => toItem(r as Record<string, unknown>));
  });
}

// ─── EXPORT CSV ────────────────────────────────────────────────────

export async function exportProtocolCsv(ctx: RlsContext, protocolId: string): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const protocol = await tx.iatfProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!protocol) {
      throw new IatfProtocolError('Protocolo IATF não encontrado', 404);
    }

    const item = toItem(protocol as unknown as Record<string, unknown>);

    const headers = [
      'Dia',
      'Descrição da Etapa',
      'Dia de IA',
      'Produto',
      'Dose',
      'Unidade',
      'Via de Administração',
      'Observações',
    ];

    const rows: string[][] = [];
    for (const step of item.steps) {
      if (step.products.length === 0) {
        rows.push([
          step.dayLabel,
          step.description,
          step.isAiDay ? 'Sim' : 'Não',
          '',
          '',
          '',
          '',
          '',
        ]);
      } else {
        for (const prod of step.products) {
          rows.push([
            step.dayLabel,
            step.description,
            step.isAiDay ? 'Sim' : 'Não',
            prod.productName,
            String(prod.dose),
            prod.doseUnitLabel,
            prod.administrationRouteLabel ?? '',
            prod.notes ?? '',
          ]);
        }
      }
    }

    const escape = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvLines = [
      `# Protocolo: ${item.name}`,
      `# Categoria: ${item.targetCategoryLabel}`,
      `# Veterinário: ${item.veterinaryAuthor ?? 'N/A'}`,
      `# Versão: ${item.version}`,
      `# Status: ${item.statusLabel}`,
      '',
      headers.map(escape).join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ];

    return csvLines.join('\n');
  });
}

// ─── METADATA ──────────────────────────────────────────────────────

export function listTargetCategories(): { value: string; label: string }[] {
  return TARGET_CATEGORIES.map((c) => ({ value: c, label: TARGET_CATEGORY_LABELS[c] }));
}

export function listIatfStatuses(): { value: string; label: string }[] {
  return IATF_PROTOCOL_STATUSES.map((s) => ({ value: s, label: IATF_PROTOCOL_STATUS_LABELS[s] }));
}

export function listDoseUnits(): { value: string; label: string }[] {
  return DOSE_UNITS.map((u) => ({ value: u, label: DOSE_UNIT_LABELS[u] }));
}

export function listAdminRoutes(): { value: string; label: string }[] {
  return ADMIN_ROUTES.map((r) => ({ value: r, label: ADMIN_ROUTE_LABELS[r] }));
}

// ─── SEED (CA4) ────────────────────────────────────────────────────

export { SEED_IATF_PROTOCOLS };
