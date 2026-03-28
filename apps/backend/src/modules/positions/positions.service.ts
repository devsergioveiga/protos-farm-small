import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PositionError,
  type CreatePositionInput,
  type UpdatePositionInput,
  type CreateSalaryBandInput,
  type ListPositionsParams,
  type PositionOutput,
  type PositionDetailOutput,
  type SalaryBandOutput,
  type StaffingViewItem,
} from './positions.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

const CBO_REGEX = /^\d{6}$/;

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'toNumber' in val)
    return (val as { toNumber(): number }).toNumber();
  return Number(val);
}

function toIso(date: unknown): string {
  if (date instanceof Date) return date.toISOString();
  return String(date);
}

function mapPosition(row: TxClient): PositionOutput {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    cbo: row.cbo ?? null,
    description: row.description ?? null,
    additionalTypes: row.additionalTypes ?? [],
    isActive: row.isActive,
    salaryBandsCount: row._count?.salaryBands ?? 0,
    employeeCount: row._count?.employeeFarms ?? 0,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapBand(band: TxClient): SalaryBandOutput {
  return {
    id: band.id,
    positionId: band.positionId,
    level: band.level,
    minSalary: toNumber(band.minSalary),
    maxSalary: toNumber(band.maxSalary),
  };
}

export async function createPosition(
  ctx: RlsContext,
  input: CreatePositionInput,
): Promise<PositionOutput> {
  if (input.cbo && !CBO_REGEX.test(input.cbo)) {
    throw new PositionError('CBO deve ter exatamente 6 dígitos numéricos', 400);
  }

  return withRlsContext(ctx, async (tx: TxClient) => {
    // Check unique name within org
    const existing = await tx.position.findFirst({
      where: { organizationId: ctx.organizationId, name: input.name },
    });
    if (existing) {
      throw new PositionError('Já existe um cargo com esse nome nesta organização', 409);
    }

    const position = await tx.position.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        cbo: input.cbo ?? null,
        description: input.description ?? null,
        additionalTypes: input.additionalTypes ?? [],
        createdBy: ctx.userId ?? 'system',
      },
      include: {
        _count: { select: { salaryBands: true, employeeFarms: true } },
      },
    });

    return mapPosition(position);
  });
}

export async function listPositions(
  ctx: RlsContext,
  params: ListPositionsParams,
): Promise<{ data: PositionOutput[]; total: number; page: number; limit: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx: TxClient) => {
    const where: TxClient = { organizationId: ctx.organizationId };

    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      tx.position.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { salaryBands: true, employeeFarms: true } },
        },
      }),
      tx.position.count({ where }),
    ]);

    return { data: data.map(mapPosition), total, page, limit };
  });
}

export async function getPosition(ctx: RlsContext, id: string): Promise<PositionDetailOutput> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const position = await tx.position.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        salaryBands: { orderBy: { level: 'asc' } },
        _count: { select: { salaryBands: true, employeeFarms: true } },
      },
    });

    if (!position) {
      throw new PositionError('Cargo não encontrado', 404);
    }

    const base = mapPosition(position);
    return {
      ...base,
      salaryBands: position.salaryBands.map(mapBand),
    };
  });
}

export async function updatePosition(
  ctx: RlsContext,
  id: string,
  input: UpdatePositionInput,
): Promise<PositionOutput> {
  if (input.cbo && !CBO_REGEX.test(input.cbo)) {
    throw new PositionError('CBO deve ter exatamente 6 dígitos numéricos', 400);
  }

  return withRlsContext(ctx, async (tx: TxClient) => {
    const existing = await tx.position.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new PositionError('Cargo não encontrado', 404);
    }

    if (input.name && input.name !== existing.name) {
      const duplicate = await tx.position.findFirst({
        where: { organizationId: ctx.organizationId, name: input.name, id: { not: id } },
      });
      if (duplicate) {
        throw new PositionError('Já existe um cargo com esse nome nesta organização', 409);
      }
    }

    const position = await tx.position.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name : undefined,
        cbo: input.cbo !== undefined ? input.cbo : undefined,
        description: input.description !== undefined ? input.description : undefined,
        additionalTypes: input.additionalTypes !== undefined ? input.additionalTypes : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
      include: {
        _count: { select: { salaryBands: true, employeeFarms: true } },
      },
    });

    return mapPosition(position);
  });
}

export async function setSalaryBands(
  ctx: RlsContext,
  positionId: string,
  bands: CreateSalaryBandInput[],
): Promise<SalaryBandOutput[]> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const position = await tx.position.findFirst({
      where: { id: positionId, organizationId: ctx.organizationId },
    });

    if (!position) {
      throw new PositionError('Cargo não encontrado', 404);
    }

    // Delete all existing bands and recreate
    await tx.salaryBand.deleteMany({ where: { positionId } });

    if (bands.length === 0) return [];

    await tx.salaryBand.createMany({
      data: bands.map((b) => ({
        positionId,
        level: b.level,
        minSalary: b.minSalary,
        maxSalary: b.maxSalary,
      })),
    });

    const created = await tx.salaryBand.findMany({
      where: { positionId },
      orderBy: { level: 'asc' },
    });

    return created.map(mapBand);
  });
}

export async function getStaffingView(ctx: RlsContext): Promise<StaffingViewItem[]> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    // Get all active employee-farm associations with their position and farm
    const employeeFarms = await tx.employeeFarm.findMany({
      where: {
        endDate: null,
        employee: { organizationId: ctx.organizationId },
        positionId: { not: null },
      },
      include: {
        position: { select: { id: true, name: true, cbo: true } },
        farm: { select: { id: true, name: true } },
      },
    });

    // Aggregate by positionId then farmId
    const byPosition = new Map<
      string,
      {
        positionId: string;
        positionName: string;
        cbo: string | null;
        byFarm: Map<string, { farmId: string; farmName: string; count: number }>;
      }
    >();

    for (const ef of employeeFarms) {
      if (!ef.positionId || !ef.position) continue;

      if (!byPosition.has(ef.positionId)) {
        byPosition.set(ef.positionId, {
          positionId: ef.positionId,
          positionName: ef.position.name,
          cbo: ef.position.cbo ?? null,
          byFarm: new Map(),
        });
      }

      const posGroup = byPosition.get(ef.positionId)!;
      const farmId = ef.farmId;
      if (!posGroup.byFarm.has(farmId)) {
        posGroup.byFarm.set(farmId, { farmId, farmName: ef.farm.name, count: 0 });
      }
      posGroup.byFarm.get(farmId)!.count++;
    }

    return Array.from(byPosition.values()).map((pg) => ({
      positionId: pg.positionId,
      positionName: pg.positionName,
      cbo: pg.cbo,
      totalEmployees: Array.from(pg.byFarm.values()).reduce((sum, f) => sum + f.count, 0),
      byFarm: Array.from(pg.byFarm.values()),
    }));
  });
}
