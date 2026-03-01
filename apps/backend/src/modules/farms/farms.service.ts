import { withRlsContext, type RlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import { logger } from '../../shared/utils/logger';
import {
  FarmError,
  VALID_UF,
  CIB_REGEX,
  LAND_CLASSIFICATIONS,
  type CreateFarmInput,
  type UpdateFarmInput,
  type ListFarmsQuery,
  type CreateRegistrationInput,
  type UpdateRegistrationInput,
} from './farms.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateUf(uf: string): void {
  if (!(VALID_UF as readonly string[]).includes(uf)) {
    throw new FarmError(`UF inválida: ${uf}`, 400);
  }
}

function validateCib(cib: string | undefined): void {
  if (cib && !CIB_REGEX.test(cib)) {
    throw new FarmError('Formato de CIB inválido. Esperado: XXX.XXX.XXX-X', 400);
  }
}

function validateLandClassification(classification: string | undefined): void {
  if (classification && !(LAND_CLASSIFICATIONS as readonly string[]).includes(classification)) {
    throw new FarmError(
      `Classificação fundiária inválida. Valores permitidos: ${LAND_CLASSIFICATIONS.join(', ')}`,
      400,
    );
  }
}

function checkAreaDivergence(
  totalAreaHa: number | { toNumber?: () => number },
  registrationAreas: number[],
): { divergent: boolean; percentage: number } | null {
  if (registrationAreas.length === 0) return null;

  const total = Number(totalAreaHa);
  const sumRegistrations = registrationAreas.reduce((a, b) => a + b, 0);

  if (total === 0) return null;

  const percentage = Math.abs((sumRegistrations - total) / total) * 100;
  return {
    divergent: percentage > 5,
    percentage: Math.round(percentage * 100) / 100,
  };
}

// ─── Create Farm ────────────────────────────────────────────────────

export async function createFarm(ctx: RlsContext, actorId: string, input: CreateFarmInput) {
  validateUf(input.state);
  validateCib(input.cib);
  validateLandClassification(input.landClassification);

  if (input.totalAreaHa <= 0) {
    throw new FarmError('Área total deve ser maior que zero', 400);
  }

  if (input.registrations) {
    for (const reg of input.registrations) {
      validateUf(reg.state);
      if (reg.areaHa <= 0) {
        throw new FarmError('Área da matrícula deve ser maior que zero', 400);
      }
    }
  }

  return withRlsContext(ctx, async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: ctx.organizationId },
      include: { _count: { select: { farms: true } } },
    });

    if (!org) {
      throw new FarmError('Organização não encontrada', 404);
    }

    if (org.status !== 'ACTIVE') {
      throw new FarmError('Organização não está ativa', 422);
    }

    if (org._count.farms >= org.maxFarms) {
      throw new FarmError('Limite de fazendas atingido', 422);
    }

    const farm = await tx.farm.create({
      data: {
        name: input.name,
        nickname: input.nickname ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state,
        zipCode: input.zipCode ?? null,
        totalAreaHa: input.totalAreaHa,
        cib: input.cib ?? null,
        incraCode: input.incraCode ?? null,
        carCode: input.carCode ?? null,
        ccirCode: input.ccirCode ?? null,
        landClassification: input.landClassification ?? null,
        productive: input.productive ?? null,
        fiscalModuleHa: input.fiscalModuleHa ?? null,
        fiscalModulesCount: input.fiscalModulesCount ?? null,
        minPartitionFraction: input.minPartitionFraction ?? null,
        appAreaHa: input.appAreaHa ?? null,
        legalReserveHa: input.legalReserveHa ?? null,
        taxableAreaHa: input.taxableAreaHa ?? null,
        usableAreaHa: input.usableAreaHa ?? null,
        utilizationDegree: input.utilizationDegree ?? null,
        organizationId: ctx.organizationId,
      },
    });

    // PostGIS point if coordinates provided
    if (input.latitude != null && input.longitude != null) {
      await prisma.$executeRawUnsafe(
        `UPDATE farms SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
        input.longitude,
        input.latitude,
        farm.id,
      );
    }

    // Create registrations in batch
    if (input.registrations && input.registrations.length > 0) {
      await tx.farmRegistration.createMany({
        data: input.registrations.map((reg) => ({
          farmId: farm.id,
          number: reg.number,
          cnsCode: reg.cnsCode ?? null,
          cartorioName: reg.cartorioName,
          comarca: reg.comarca,
          state: reg.state,
          livro: reg.livro ?? null,
          registrationDate: reg.registrationDate ? new Date(reg.registrationDate) : null,
          areaHa: reg.areaHa,
        })),
      });
    }

    // Create UserFarmAccess for the creator
    await tx.userFarmAccess.create({
      data: { userId: actorId, farmId: farm.id },
    });

    const result = await tx.farm.findUnique({
      where: { id: farm.id },
      include: {
        registrations: true,
        _count: { select: { registrations: true } },
      },
    });

    // Area divergence warning
    let areaDivergence = null;
    if (input.registrations && input.registrations.length > 0) {
      areaDivergence = checkAreaDivergence(
        input.totalAreaHa,
        input.registrations.map((r) => r.areaHa),
      );
    }

    logger.info({ farmId: farm.id, orgId: ctx.organizationId }, 'Farm created');

    return { ...result, areaDivergence };
  });
}

// ─── List Farms ─────────────────────────────────────────────────────

export async function listFarms(ctx: RlsContext, query: ListFarmsQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: ctx.organizationId };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { nickname: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.state) {
    where.state = query.state;
  }

  return withRlsContext(ctx, async (tx) => {
    const [data, total] = await Promise.all([
      tx.farm.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { registrations: true } },
        },
      }),
      tx.farm.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

// ─── Get Farm ───────────────────────────────────────────────────────

export async function getFarm(ctx: RlsContext, farmId: string) {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({
      where: { id: farmId },
      include: {
        registrations: { orderBy: { createdAt: 'asc' } },
        userAccess: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    return farm;
  });
}

// ─── Update Farm ────────────────────────────────────────────────────

export async function updateFarm(ctx: RlsContext, farmId: string, input: UpdateFarmInput) {
  if (input.state) {
    validateUf(input.state);
  }
  if (input.cib !== undefined) {
    validateCib(input.cib);
  }
  if (input.landClassification !== undefined) {
    validateLandClassification(input.landClassification);
  }
  if (input.totalAreaHa !== undefined && input.totalAreaHa <= 0) {
    throw new FarmError('Área total deve ser maior que zero', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.farm.findUnique({ where: { id: farmId } });
    if (!existing) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const updated = await tx.farm.update({
      where: { id: farmId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.nickname !== undefined && { nickname: input.nickname || null }),
        ...(input.address !== undefined && { address: input.address || null }),
        ...(input.city !== undefined && { city: input.city || null }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.zipCode !== undefined && { zipCode: input.zipCode || null }),
        ...(input.totalAreaHa !== undefined && { totalAreaHa: input.totalAreaHa }),
        ...(input.cib !== undefined && { cib: input.cib || null }),
        ...(input.incraCode !== undefined && { incraCode: input.incraCode || null }),
        ...(input.carCode !== undefined && { carCode: input.carCode || null }),
        ...(input.ccirCode !== undefined && { ccirCode: input.ccirCode || null }),
        ...(input.landClassification !== undefined && {
          landClassification: input.landClassification || null,
        }),
        ...(input.productive !== undefined && { productive: input.productive }),
        ...(input.fiscalModuleHa !== undefined && { fiscalModuleHa: input.fiscalModuleHa }),
        ...(input.fiscalModulesCount !== undefined && {
          fiscalModulesCount: input.fiscalModulesCount,
        }),
        ...(input.minPartitionFraction !== undefined && {
          minPartitionFraction: input.minPartitionFraction,
        }),
        ...(input.appAreaHa !== undefined && { appAreaHa: input.appAreaHa }),
        ...(input.legalReserveHa !== undefined && { legalReserveHa: input.legalReserveHa }),
        ...(input.taxableAreaHa !== undefined && { taxableAreaHa: input.taxableAreaHa }),
        ...(input.usableAreaHa !== undefined && { usableAreaHa: input.usableAreaHa }),
        ...(input.utilizationDegree !== undefined && {
          utilizationDegree: input.utilizationDegree,
        }),
      },
      include: { registrations: true },
    });

    // Update PostGIS point if coordinates changed
    if (input.latitude != null && input.longitude != null) {
      await prisma.$executeRawUnsafe(
        `UPDATE farms SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
        input.longitude,
        input.latitude,
        farmId,
      );
    }

    logger.info({ farmId, orgId: ctx.organizationId }, 'Farm updated');

    return updated;
  });
}

// ─── Toggle Farm Status ─────────────────────────────────────────────

export async function toggleFarmStatus(
  ctx: RlsContext,
  farmId: string,
  status: 'ACTIVE' | 'INACTIVE',
) {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const updated = await tx.farm.update({
      where: { id: farmId },
      data: { status },
    });

    logger.info({ farmId, orgId: ctx.organizationId, status }, 'Farm status updated');

    return updated;
  });
}

// ─── Farm Limit ─────────────────────────────────────────────────────

export async function getFarmLimit(ctx: RlsContext) {
  return withRlsContext(ctx, async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: ctx.organizationId },
      include: { _count: { select: { farms: true } } },
    });

    if (!org) {
      throw new FarmError('Organização não encontrada', 404);
    }

    const current = org._count.farms;
    const max = org.maxFarms;
    const percentage = Math.round((current / max) * 100);

    return {
      current,
      max,
      percentage,
      warning: percentage >= 80,
      blocked: percentage >= 100,
    };
  });
}

// ─── Add Registration ───────────────────────────────────────────────

export async function addRegistration(
  ctx: RlsContext,
  farmId: string,
  input: CreateRegistrationInput,
) {
  validateUf(input.state);

  if (input.areaHa <= 0) {
    throw new FarmError('Área da matrícula deve ser maior que zero', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({
      where: { id: farmId },
      include: { registrations: true },
    });

    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const registration = await tx.farmRegistration.create({
      data: {
        farmId,
        number: input.number,
        cnsCode: input.cnsCode ?? null,
        cartorioName: input.cartorioName,
        comarca: input.comarca,
        state: input.state,
        livro: input.livro ?? null,
        registrationDate: input.registrationDate ? new Date(input.registrationDate) : null,
        areaHa: input.areaHa,
      },
    });

    // Check area divergence
    const allAreas = [...farm.registrations.map((r) => Number(r.areaHa)), input.areaHa];
    const areaDivergence = checkAreaDivergence(farm.totalAreaHa, allAreas);

    logger.info({ farmId, registrationId: registration.id }, 'Farm registration added');

    return { ...registration, areaDivergence };
  });
}

// ─── Update Registration ────────────────────────────────────────────

export async function updateRegistration(
  ctx: RlsContext,
  farmId: string,
  regId: string,
  input: UpdateRegistrationInput,
) {
  if (input.state) {
    validateUf(input.state);
  }
  if (input.areaHa !== undefined && input.areaHa <= 0) {
    throw new FarmError('Área da matrícula deve ser maior que zero', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({
      where: { id: farmId },
      include: { registrations: true },
    });

    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const existing = farm.registrations.find((r) => r.id === regId);
    if (!existing) {
      throw new FarmError('Matrícula não encontrada', 404);
    }

    const updated = await tx.farmRegistration.update({
      where: { id: regId },
      data: {
        ...(input.number !== undefined && { number: input.number }),
        ...(input.cnsCode !== undefined && { cnsCode: input.cnsCode || null }),
        ...(input.cartorioName !== undefined && { cartorioName: input.cartorioName }),
        ...(input.comarca !== undefined && { comarca: input.comarca }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.livro !== undefined && { livro: input.livro || null }),
        ...(input.registrationDate !== undefined && {
          registrationDate: input.registrationDate ? new Date(input.registrationDate) : null,
        }),
        ...(input.areaHa !== undefined && { areaHa: input.areaHa }),
      },
    });

    // Recalculate area divergence
    const allAreas = farm.registrations.map((r) =>
      r.id === regId ? (input.areaHa ?? Number(r.areaHa)) : Number(r.areaHa),
    );
    const areaDivergence = checkAreaDivergence(farm.totalAreaHa, allAreas);

    logger.info({ farmId, registrationId: regId }, 'Farm registration updated');

    return { ...updated, areaDivergence };
  });
}

// ─── Delete Registration ────────────────────────────────────────────

export async function deleteRegistration(ctx: RlsContext, farmId: string, regId: string) {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({
      where: { id: farmId },
      include: { registrations: true },
    });

    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const existing = farm.registrations.find((r) => r.id === regId);
    if (!existing) {
      throw new FarmError('Matrícula não encontrada', 404);
    }

    await tx.farmRegistration.delete({ where: { id: regId } });

    // Recalculate area divergence with remaining registrations
    const remainingAreas = farm.registrations
      .filter((r) => r.id !== regId)
      .map((r) => Number(r.areaHa));
    const areaDivergence = checkAreaDivergence(farm.totalAreaHa, remainingAreas);

    logger.info({ farmId, registrationId: regId }, 'Farm registration deleted');

    return { message: 'Matrícula removida com sucesso', areaDivergence };
  });
}
