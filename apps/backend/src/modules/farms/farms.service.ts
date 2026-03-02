import { withRlsContext, type RlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import { logger } from '../../shared/utils/logger';
import {
  FarmError,
  VALID_UF,
  CIB_REGEX,
  LAND_CLASSIFICATIONS,
  VALID_SOIL_TYPES,
  type CreateFarmInput,
  type UpdateFarmInput,
  type ListFarmsQuery,
  type CreateRegistrationInput,
  type UpdateRegistrationInput,
  type BoundaryUploadResult,
  type BoundaryInfo,
  type FarmListCaller,
  type DeleteFarmInput,
  type BoundaryVersionItem,
  type CreateFieldPlotInput,
  type UpdateFieldPlotInput,
  type FieldPlotItem,
  type FieldPlotsSummary,
  type CreateFieldPlotResult,
  MAX_BULK_FEATURES,
  type BulkPreviewResult,
  type BulkPreviewFeature,
  type BulkImportInput,
  type BulkImportResult,
  type BulkImportResultItem,
  type ColumnMapping,
} from './farms.types';
import { ROLE_HIERARCHY } from '../../shared/rbac/permissions';
import {
  parseGeoFile,
  validateGeometry,
  calculateAreaHa,
  parseGeoFileWithFeatures,
} from './geo-parser';
import intersect from '@turf/intersect';
import area from '@turf/area';
import { polygon as turfPolygon, featureCollection } from '@turf/helpers';

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

export async function listFarms(ctx: RlsContext, caller: FarmListCaller, query: ListFarmsQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: ctx.organizationId, deletedAt: null };

  // Non-admin users only see farms they have access to
  if (ROLE_HIERARCHY[caller.role as keyof typeof ROLE_HIERARCHY] < 90) {
    where.userAccess = { some: { userId: caller.userId } };
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { nickname: { contains: query.search, mode: 'insensitive' } },
      { city: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.state) {
    where.state = query.state;
  }

  if (query.minAreaHa != null || query.maxAreaHa != null) {
    const areaFilter: Record<string, number> = {};
    if (query.minAreaHa != null) areaFilter.gte = query.minAreaHa;
    if (query.maxAreaHa != null) areaFilter.lte = query.maxAreaHa;
    where.totalAreaHa = areaFilter;
  }

  return withRlsContext(ctx, async (tx) => {
    const data = await tx.farm.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { registrations: true, fieldPlots: { where: { deletedAt: null } } } },
      },
    });
    const total = await tx.farm.count({ where });

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

    if (!farm || farm.deletedAt) {
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

// ─── Soft Delete Farm ──────────────────────────────────────────────

export async function softDeleteFarm(ctx: RlsContext, farmId: string, input: DeleteFarmInput) {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm || farm.deletedAt) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    if (farm.name.toLowerCase() !== input.confirmName.toLowerCase()) {
      throw new FarmError('Nome de confirmação não confere com o nome da fazenda', 400);
    }

    // TODO: Check for active dependencies (safras, animais, lançamentos financeiros)
    // These tables don't exist yet. When they are created, add checks here:
    // const activeCrops = await tx.crop.count({ where: { farmId, status: 'ACTIVE' } });
    // const activeAnimals = await tx.animal.count({ where: { farmId } });
    // const pendingFinancials = await tx.financialEntry.count({ where: { farmId, status: 'PENDING' } });
    // const blockers: string[] = [];
    // if (activeCrops > 0) blockers.push(`${activeCrops} safra(s) ativa(s)`);
    // if (activeAnimals > 0) blockers.push(`${activeAnimals} animal(is) vinculado(s)`);
    // if (pendingFinancials > 0) blockers.push(`${pendingFinancials} lançamento(s) financeiro(s) pendente(s)`);
    // if (blockers.length > 0) {
    //   throw new FarmError(`Não é possível excluir. Dependências ativas: ${blockers.join(', ')}`, 422);
    // }

    await tx.farm.update({
      where: { id: farmId },
      data: { deletedAt: new Date() },
    });

    logger.info({ farmId, orgId: ctx.organizationId }, 'Farm soft-deleted');

    return { message: 'Fazenda excluída com sucesso' };
  });
}

// ─── Boundary Versions ─────────────────────────────────────────────

export async function getBoundaryVersions(
  ctx: RlsContext,
  farmId: string,
  registrationId?: string,
): Promise<BoundaryVersionItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm || farm.deletedAt) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const where: Record<string, unknown> = { farmId };
    if (registrationId) {
      where.registrationId = registrationId;
    } else {
      where.registrationId = null;
    }

    const versions = await tx.farmBoundaryVersion.findMany({
      where,
      orderBy: { version: 'desc' },
      select: {
        id: true,
        farmId: true,
        registrationId: true,
        boundaryAreaHa: true,
        uploadedBy: true,
        uploadedAt: true,
        filename: true,
        version: true,
      },
    });

    return versions.map((v) => ({
      ...v,
      boundaryAreaHa: Number(v.boundaryAreaHa),
      uploadedAt: v.uploadedAt.toISOString(),
    }));
  });
}

// ─── Upload Farm Boundary ──────────────────────────────────────────

export async function uploadFarmBoundary(
  ctx: RlsContext,
  farmId: string,
  buffer: Buffer,
  filename: string,
  actorId: string,
): Promise<BoundaryUploadResult> {
  const parsed = await parseGeoFile(buffer, filename);
  const polygon = parsed.boundaries[0];
  const warnings = [...parsed.warnings];

  if (parsed.boundaries.length > 1) {
    warnings.push('Múltiplos polígonos encontrados; usando o primeiro');
  }

  const validation = validateGeometry(polygon);
  if (!validation.valid) {
    throw new FarmError(`Geometria inválida: ${validation.errors.join('; ')}`, 400);
  }

  const geojsonStr = JSON.stringify(polygon);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    // Save current boundary as a version before overwriting
    const existingBoundary = await prisma.$queryRawUnsafe<
      { has_boundary: boolean; area_ha: number | null }[]
    >(
      `SELECT boundary IS NOT NULL AS has_boundary, "boundaryAreaHa"::float AS area_ha FROM farms WHERE id = $1`,
      farmId,
    );

    if (existingBoundary[0]?.has_boundary) {
      const lastVersion = await tx.farmBoundaryVersion.findFirst({
        where: { farmId, registrationId: null },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (lastVersion?.version ?? 0) + 1;

      await prisma.$executeRawUnsafe(
        `INSERT INTO farm_boundary_versions (id, "farmId", "registrationId", boundary, "boundaryAreaHa", "uploadedBy", "uploadedAt", filename, version)
         SELECT gen_random_uuid(), id, NULL, boundary, "boundaryAreaHa", $2, now(), NULL, $3
         FROM farms WHERE id = $1 AND boundary IS NOT NULL`,
        farmId,
        actorId,
        nextVersion,
      );
    }

    // Insert boundary and calculate area using PostGIS
    const result = await prisma.$queryRawUnsafe<{ area_ha: number; is_valid: boolean }[]>(
      `UPDATE farms
       SET boundary = ST_GeomFromGeoJSON($1),
           "boundaryAreaHa" = ROUND((ST_Area(ST_GeomFromGeoJSON($1)::geography) / 10000)::numeric, 4)
       WHERE id = $2
       RETURNING
         ROUND((ST_Area(boundary::geography) / 10000)::numeric, 4)::float AS area_ha,
         ST_IsValid(boundary) AS is_valid`,
      geojsonStr,
      farmId,
    );

    const boundaryAreaHa = result[0].area_ha;

    if (!result[0].is_valid) {
      warnings.push('PostGIS marcou a geometria como inválida (ST_IsValid=false)');
    }

    // Compare with totalAreaHa
    const totalAreaHa = Number(farm.totalAreaHa);
    let areaDivergence = null;
    if (totalAreaHa > 0) {
      const percentage =
        Math.round(Math.abs((boundaryAreaHa - totalAreaHa) / totalAreaHa) * 10000) / 100;
      areaDivergence = {
        referenceAreaHa: totalAreaHa,
        boundaryAreaHa,
        percentage,
        warning: percentage > 10,
      };
      if (areaDivergence.warning) {
        warnings.push(
          `Divergência de ${percentage}% entre área do perímetro (${boundaryAreaHa} ha) e área total cadastrada (${totalAreaHa} ha)`,
        );
      }
    }

    logger.info({ farmId, boundaryAreaHa }, 'Farm boundary uploaded');

    return { boundaryAreaHa, areaDivergence, warnings };
  });
}

// ─── Upload Registration Boundary ──────────────────────────────────

export async function uploadRegistrationBoundary(
  ctx: RlsContext,
  farmId: string,
  regId: string,
  buffer: Buffer,
  filename: string,
  actorId: string,
): Promise<BoundaryUploadResult> {
  const parsed = await parseGeoFile(buffer, filename);
  const polygon = parsed.boundaries[0];
  const warnings = [...parsed.warnings];

  if (parsed.boundaries.length > 1) {
    warnings.push('Múltiplos polígonos encontrados; usando o primeiro');
  }

  const validation = validateGeometry(polygon);
  if (!validation.valid) {
    throw new FarmError(`Geometria inválida: ${validation.errors.join('; ')}`, 400);
  }

  const geojsonStr = JSON.stringify(polygon);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({
      where: { id: farmId },
      include: { registrations: true },
    });
    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const reg = farm.registrations.find((r) => r.id === regId);
    if (!reg) {
      throw new FarmError('Matrícula não encontrada', 404);
    }

    // Save current boundary as a version before overwriting
    const existingRegBoundary = await prisma.$queryRawUnsafe<
      { has_boundary: boolean; area_ha: number | null }[]
    >(
      `SELECT boundary IS NOT NULL AS has_boundary, "boundaryAreaHa"::float AS area_ha FROM farm_registrations WHERE id = $1`,
      regId,
    );

    if (existingRegBoundary[0]?.has_boundary) {
      const lastVersion = await tx.farmBoundaryVersion.findFirst({
        where: { farmId, registrationId: regId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (lastVersion?.version ?? 0) + 1;

      await prisma.$executeRawUnsafe(
        `INSERT INTO farm_boundary_versions (id, "farmId", "registrationId", boundary, "boundaryAreaHa", "uploadedBy", "uploadedAt", filename, version)
         SELECT gen_random_uuid(), $3, id, boundary, "boundaryAreaHa", $2, now(), NULL, $4
         FROM farm_registrations WHERE id = $1 AND boundary IS NOT NULL`,
        regId,
        actorId,
        farmId,
        nextVersion,
      );
    }

    const result = await prisma.$queryRawUnsafe<{ area_ha: number; is_valid: boolean }[]>(
      `UPDATE farm_registrations
       SET boundary = ST_GeomFromGeoJSON($1),
           "boundaryAreaHa" = ROUND((ST_Area(ST_GeomFromGeoJSON($1)::geography) / 10000)::numeric, 4)
       WHERE id = $2
       RETURNING
         ROUND((ST_Area(boundary::geography) / 10000)::numeric, 4)::float AS area_ha,
         ST_IsValid(boundary) AS is_valid`,
      geojsonStr,
      regId,
    );

    const boundaryAreaHa = result[0].area_ha;

    if (!result[0].is_valid) {
      warnings.push('PostGIS marcou a geometria como inválida (ST_IsValid=false)');
    }

    // Compare with registration areaHa
    const refAreaHa = Number(reg.areaHa);
    let areaDivergence = null;
    if (refAreaHa > 0) {
      const percentage =
        Math.round(Math.abs((boundaryAreaHa - refAreaHa) / refAreaHa) * 10000) / 100;
      areaDivergence = {
        referenceAreaHa: refAreaHa,
        boundaryAreaHa,
        percentage,
        warning: percentage > 10,
      };
      if (areaDivergence.warning) {
        warnings.push(
          `Divergência de ${percentage}% entre área do perímetro (${boundaryAreaHa} ha) e área da matrícula (${refAreaHa} ha)`,
        );
      }
    }

    logger.info({ farmId, regId, boundaryAreaHa }, 'Registration boundary uploaded');

    return { boundaryAreaHa, areaDivergence, warnings };
  });
}

// ─── Get Farm Boundary ─────────────────────────────────────────────

export async function getFarmBoundary(ctx: RlsContext, farmId: string): Promise<BoundaryInfo> {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const rows = await prisma.$queryRawUnsafe<{ geojson: string | null; area_ha: number | null }[]>(
      `SELECT ST_AsGeoJSON(boundary)::text AS geojson, "boundaryAreaHa"::float AS area_ha
       FROM farms WHERE id = $1`,
      farmId,
    );

    const row = rows[0];
    if (!row?.geojson) {
      return { hasBoundary: false, boundaryAreaHa: null, boundaryGeoJSON: null };
    }

    return {
      hasBoundary: true,
      boundaryAreaHa: row.area_ha,
      boundaryGeoJSON: JSON.parse(row.geojson) as GeoJSON.Polygon,
    };
  });
}

// ─── Get Registration Boundary ─────────────────────────────────────

export async function getRegistrationBoundary(
  ctx: RlsContext,
  farmId: string,
  regId: string,
): Promise<BoundaryInfo> {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({
      where: { id: farmId },
      include: { registrations: true },
    });
    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const reg = farm.registrations.find((r) => r.id === regId);
    if (!reg) {
      throw new FarmError('Matrícula não encontrada', 404);
    }

    const rows = await prisma.$queryRawUnsafe<{ geojson: string | null; area_ha: number | null }[]>(
      `SELECT ST_AsGeoJSON(boundary)::text AS geojson, "boundaryAreaHa"::float AS area_ha
       FROM farm_registrations WHERE id = $1`,
      regId,
    );

    const row = rows[0];
    if (!row?.geojson) {
      return { hasBoundary: false, boundaryAreaHa: null, boundaryGeoJSON: null };
    }

    return {
      hasBoundary: true,
      boundaryAreaHa: row.area_ha,
      boundaryGeoJSON: JSON.parse(row.geojson) as GeoJSON.Polygon,
    };
  });
}

// ─── Delete Farm Boundary ──────────────────────────────────────────

export async function deleteFarmBoundary(ctx: RlsContext, farmId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    await prisma.$executeRawUnsafe(
      `UPDATE farms SET boundary = NULL, "boundaryAreaHa" = NULL WHERE id = $1`,
      farmId,
    );

    logger.info({ farmId }, 'Farm boundary deleted');
  });
}

// ─── Field Plots ──────────────────────────────────────────────────

function validateSoilType(soilType: string | undefined | null): void {
  if (soilType && !(VALID_SOIL_TYPES as readonly string[]).includes(soilType)) {
    throw new FarmError(
      `Tipo de solo inválido. Valores permitidos: ${VALID_SOIL_TYPES.join(', ')}`,
      400,
    );
  }
}

function toFieldPlotItem(row: {
  id: string;
  farmId: string;
  registrationId: string | null;
  name: string;
  code: string | null;
  soilType: string | null;
  currentCrop: string | null;
  previousCrop: string | null;
  notes: string | null;
  boundaryAreaHa: { toNumber?: () => number } | number;
  status: string;
  createdAt: Date;
}): FieldPlotItem {
  return {
    id: row.id,
    farmId: row.farmId,
    registrationId: row.registrationId,
    name: row.name,
    code: row.code,
    soilType: row.soilType,
    currentCrop: row.currentCrop,
    previousCrop: row.previousCrop,
    notes: row.notes,
    boundaryAreaHa:
      typeof row.boundaryAreaHa === 'number' ? row.boundaryAreaHa : Number(row.boundaryAreaHa),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createFieldPlot(
  ctx: RlsContext,
  farmId: string,
  input: CreateFieldPlotInput,
  buffer: Buffer,
  filename: string,
): Promise<CreateFieldPlotResult> {
  if (!input.name) {
    throw new FarmError('Nome do talhão é obrigatório', 400);
  }

  validateSoilType(input.soilType);

  const parsed = await parseGeoFile(buffer, filename);
  const polygon = parsed.boundaries[0];
  const warnings = [...parsed.warnings];

  if (parsed.boundaries.length > 1) {
    warnings.push('Múltiplos polígonos encontrados; usando o primeiro');
  }

  const validation = validateGeometry(polygon);
  if (!validation.valid) {
    throw new FarmError(`Geometria inválida: ${validation.errors.join('; ')}`, 400);
  }

  const geojsonStr = JSON.stringify(polygon);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm || farm.deletedAt) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    // Validate registrationId belongs to this farm
    if (input.registrationId) {
      const reg = await tx.farmRegistration.findFirst({
        where: { id: input.registrationId, farmId },
      });
      if (!reg) {
        throw new FarmError('Matrícula não pertence a esta fazenda', 400);
      }
    }

    // Validation 1: containment check (warning only, does not block)
    const containmentCheck = await prisma.$queryRawUnsafe<{ is_contained: boolean }[]>(
      `SELECT ST_Within(ST_GeomFromGeoJSON($1), boundary) AS is_contained
       FROM farms WHERE id = $2 AND boundary IS NOT NULL`,
      geojsonStr,
      farmId,
    );
    if (containmentCheck.length > 0 && !containmentCheck[0].is_contained) {
      warnings.push('Talhão extrapola o perímetro da fazenda');
    }

    // Validation 2: overlap check (blocks if >5%)
    const overlapCheck = await prisma.$queryRawUnsafe<{ plot_id: string; overlap_pct: number }[]>(
      `SELECT id AS plot_id,
              ROUND((ST_Area(ST_Intersection(boundary, ST_GeomFromGeoJSON($1))::geography)
                / ST_Area(ST_GeomFromGeoJSON($1)::geography) * 100)::numeric, 2)::float AS overlap_pct
       FROM field_plots
       WHERE "farmId" = $2
         AND "deletedAt" IS NULL
         AND ST_Intersects(boundary, ST_GeomFromGeoJSON($1))`,
      geojsonStr,
      farmId,
    );

    for (const ov of overlapCheck) {
      if (ov.overlap_pct > 5) {
        throw new FarmError(
          `Sobreposição de ${ov.overlap_pct}% com talhão existente (máximo permitido: 5%)`,
          422,
        );
      }
    }

    // Insert using raw SQL for PostGIS boundary
    const inserted = await prisma.$queryRawUnsafe<
      {
        id: string;
        area_ha: number;
      }[]
    >(
      `INSERT INTO field_plots (id, "farmId", "registrationId", name, code, "soilType", "currentCrop", "previousCrop", notes, boundary, "boundaryAreaHa", status, "createdAt", "updatedAt")
       VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5::"SoilType", $6, $7, $8,
         ST_GeomFromGeoJSON($9),
         ROUND((ST_Area(ST_GeomFromGeoJSON($9)::geography) / 10000)::numeric, 4),
         'ACTIVE', now(), now()
       )
       RETURNING id, ROUND((ST_Area(boundary::geography) / 10000)::numeric, 4)::float AS area_ha`,
      farmId,
      input.registrationId ?? null,
      input.name,
      input.code ?? null,
      input.soilType ?? null,
      input.currentCrop ?? null,
      input.previousCrop ?? null,
      input.notes ?? null,
      geojsonStr,
    );

    const row = inserted[0];

    logger.info({ farmId, plotId: row.id, areaHa: row.area_ha }, 'Field plot created');

    return {
      plot: {
        id: row.id,
        farmId,
        registrationId: input.registrationId ?? null,
        name: input.name,
        code: input.code ?? null,
        soilType: input.soilType ?? null,
        currentCrop: input.currentCrop ?? null,
        previousCrop: input.previousCrop ?? null,
        notes: input.notes ?? null,
        boundaryAreaHa: row.area_ha,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      warnings,
    };
  });
}

export async function listFieldPlots(ctx: RlsContext, farmId: string): Promise<FieldPlotItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm || farm.deletedAt) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const plots = await tx.fieldPlot.findMany({
      where: { farmId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return plots.map(toFieldPlotItem);
  });
}

export async function getFieldPlot(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
): Promise<FieldPlotItem> {
  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({
      where: { id: plotId, farmId, deletedAt: null },
    });

    if (!plot) {
      throw new FarmError('Talhão não encontrado', 404);
    }

    return toFieldPlotItem(plot);
  });
}

export async function updateFieldPlot(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
  input: UpdateFieldPlotInput,
): Promise<FieldPlotItem> {
  if (input.soilType !== undefined) {
    validateSoilType(input.soilType);
  }

  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({
      where: { id: plotId, farmId, deletedAt: null },
    });

    if (!plot) {
      throw new FarmError('Talhão não encontrado', 404);
    }

    // Validate registrationId belongs to this farm
    if (input.registrationId) {
      const reg = await tx.farmRegistration.findFirst({
        where: { id: input.registrationId, farmId },
      });
      if (!reg) {
        throw new FarmError('Matrícula não pertence a esta fazenda', 400);
      }
    }

    const updated = await tx.fieldPlot.update({
      where: { id: plotId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.code !== undefined && { code: input.code || null }),
        ...(input.soilType !== undefined && { soilType: (input.soilType as never) || null }),
        ...(input.currentCrop !== undefined && { currentCrop: input.currentCrop || null }),
        ...(input.previousCrop !== undefined && { previousCrop: input.previousCrop || null }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
        ...(input.registrationId !== undefined && { registrationId: input.registrationId || null }),
      },
    });

    logger.info({ farmId, plotId }, 'Field plot updated');

    return toFieldPlotItem(updated);
  });
}

export async function uploadFieldPlotBoundary(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
  buffer: Buffer,
  filename: string,
): Promise<{ boundaryAreaHa: number; warnings: string[] }> {
  const parsed = await parseGeoFile(buffer, filename);
  const polygon = parsed.boundaries[0];
  const warnings = [...parsed.warnings];

  if (parsed.boundaries.length > 1) {
    warnings.push('Múltiplos polígonos encontrados; usando o primeiro');
  }

  const validation = validateGeometry(polygon);
  if (!validation.valid) {
    throw new FarmError(`Geometria inválida: ${validation.errors.join('; ')}`, 400);
  }

  const geojsonStr = JSON.stringify(polygon);

  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({
      where: { id: plotId, farmId, deletedAt: null },
    });
    if (!plot) {
      throw new FarmError('Talhão não encontrado', 404);
    }

    // Containment check
    const containmentCheck = await prisma.$queryRawUnsafe<{ is_contained: boolean }[]>(
      `SELECT ST_Within(ST_GeomFromGeoJSON($1), boundary) AS is_contained
       FROM farms WHERE id = $2 AND boundary IS NOT NULL`,
      geojsonStr,
      farmId,
    );
    if (containmentCheck.length > 0 && !containmentCheck[0].is_contained) {
      warnings.push('Talhão extrapola o perímetro da fazenda');
    }

    // Overlap check (exclude self)
    const overlapCheck = await prisma.$queryRawUnsafe<{ plot_id: string; overlap_pct: number }[]>(
      `SELECT id AS plot_id,
              ROUND((ST_Area(ST_Intersection(boundary, ST_GeomFromGeoJSON($1))::geography)
                / ST_Area(ST_GeomFromGeoJSON($1)::geography) * 100)::numeric, 2)::float AS overlap_pct
       FROM field_plots
       WHERE "farmId" = $2
         AND id != $3
         AND "deletedAt" IS NULL
         AND ST_Intersects(boundary, ST_GeomFromGeoJSON($1))`,
      geojsonStr,
      farmId,
      plotId,
    );

    for (const ov of overlapCheck) {
      if (ov.overlap_pct > 5) {
        throw new FarmError(
          `Sobreposição de ${ov.overlap_pct}% com talhão existente (máximo permitido: 5%)`,
          422,
        );
      }
    }

    const result = await prisma.$queryRawUnsafe<{ area_ha: number }[]>(
      `UPDATE field_plots
       SET boundary = ST_GeomFromGeoJSON($1),
           "boundaryAreaHa" = ROUND((ST_Area(ST_GeomFromGeoJSON($1)::geography) / 10000)::numeric, 4),
           "updatedAt" = now()
       WHERE id = $2
       RETURNING ROUND((ST_Area(boundary::geography) / 10000)::numeric, 4)::float AS area_ha`,
      geojsonStr,
      plotId,
    );

    const boundaryAreaHa = result[0].area_ha;
    logger.info({ farmId, plotId, boundaryAreaHa }, 'Field plot boundary updated');

    return { boundaryAreaHa, warnings };
  });
}

export async function getFieldPlotBoundary(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
): Promise<BoundaryInfo> {
  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({
      where: { id: plotId, farmId, deletedAt: null },
    });
    if (!plot) {
      throw new FarmError('Talhão não encontrado', 404);
    }

    const rows = await prisma.$queryRawUnsafe<{ geojson: string | null; area_ha: number | null }[]>(
      `SELECT ST_AsGeoJSON(boundary)::text AS geojson, "boundaryAreaHa"::float AS area_ha
       FROM field_plots WHERE id = $1`,
      plotId,
    );

    const row = rows[0];
    if (!row?.geojson) {
      return { hasBoundary: false, boundaryAreaHa: null, boundaryGeoJSON: null };
    }

    return {
      hasBoundary: true,
      boundaryAreaHa: row.area_ha,
      boundaryGeoJSON: JSON.parse(row.geojson) as GeoJSON.Polygon,
    };
  });
}

export async function deleteFieldPlot(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
): Promise<{ message: string }> {
  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({
      where: { id: plotId, farmId, deletedAt: null },
    });
    if (!plot) {
      throw new FarmError('Talhão não encontrado', 404);
    }

    await tx.fieldPlot.update({
      where: { id: plotId },
      data: { deletedAt: new Date() },
    });

    logger.info({ farmId, plotId }, 'Field plot soft-deleted');

    return { message: 'Talhão excluído com sucesso' };
  });
}

export async function getFieldPlotsSummary(
  ctx: RlsContext,
  farmId: string,
): Promise<FieldPlotsSummary> {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm || farm.deletedAt) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const result = await prisma.$queryRawUnsafe<{ total_plot_area: number; plot_count: number }[]>(
      `SELECT COALESCE(SUM("boundaryAreaHa"::float), 0) AS total_plot_area,
              COUNT(*)::int AS plot_count
       FROM field_plots
       WHERE "farmId" = $1 AND "deletedAt" IS NULL`,
      farmId,
    );

    const farmTotalAreaHa = Number(farm.totalAreaHa);
    const totalPlotAreaHa = result[0].total_plot_area;
    const plotCount = result[0].plot_count;

    return {
      totalPlotAreaHa: Math.round(totalPlotAreaHa * 10000) / 10000,
      farmTotalAreaHa,
      unmappedAreaHa: Math.round((farmTotalAreaHa - totalPlotAreaHa) * 10000) / 10000,
      plotCount,
    };
  });
}

// ─── Delete Registration Boundary ──────────────────────────────────

export async function deleteRegistrationBoundary(
  ctx: RlsContext,
  farmId: string,
  regId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({
      where: { id: farmId },
      include: { registrations: true },
    });
    if (!farm) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    const reg = farm.registrations.find((r) => r.id === regId);
    if (!reg) {
      throw new FarmError('Matrícula não encontrada', 404);
    }

    await prisma.$executeRawUnsafe(
      `UPDATE farm_registrations SET boundary = NULL, "boundaryAreaHa" = NULL WHERE id = $1`,
      regId,
    );

    logger.info({ farmId, regId }, 'Registration boundary deleted');
  });
}

// ─── Bulk Import ─────────────────────────────────────────────────────

export async function previewBulkImport(
  ctx: RlsContext,
  farmId: string,
  buffer: Buffer,
  filename: string,
): Promise<BulkPreviewResult> {
  const parsed = await parseGeoFileWithFeatures(buffer, filename);

  if (parsed.features.length > MAX_BULK_FEATURES) {
    throw new FarmError(
      `Arquivo contém ${parsed.features.length} features (máximo: ${MAX_BULK_FEATURES})`,
      400,
    );
  }

  const previewFeatures: BulkPreviewFeature[] = [];

  // Get farm boundary for containment check
  const farmBoundaryRows = await prisma.$queryRawUnsafe<{ boundary_geojson: string }[]>(
    `SELECT ST_AsGeoJSON(boundary)::text AS boundary_geojson FROM farms WHERE id = $1 AND boundary IS NOT NULL`,
    farmId,
  );
  const hasFarmBoundary = farmBoundaryRows.length > 0;

  for (const feature of parsed.features) {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Geometry validation
    const validation = validateGeometry(feature.polygon);
    if (!validation.valid) {
      errors.push(...validation.errors);
    }

    // Calculate area via turf
    let areaHa = 0;
    if (validation.valid) {
      areaHa = calculateAreaHa(feature.polygon);
    }

    // Containment check
    if (validation.valid && hasFarmBoundary) {
      const geojsonStr = JSON.stringify(feature.polygon);
      const containmentCheck = await prisma.$queryRawUnsafe<{ is_contained: boolean }[]>(
        `SELECT ST_Within(ST_GeomFromGeoJSON($1), boundary) AS is_contained
         FROM farms WHERE id = $2 AND boundary IS NOT NULL`,
        geojsonStr,
        farmId,
      );
      if (containmentCheck.length > 0 && !containmentCheck[0].is_contained) {
        warnings.push('Talhão extrapola o perímetro da fazenda');
      }
    }

    // Overlap check against existing plots in DB
    if (validation.valid) {
      const geojsonStr = JSON.stringify(feature.polygon);
      const overlapCheck = await prisma.$queryRawUnsafe<
        { plot_name: string; overlap_pct: number }[]
      >(
        `SELECT name AS plot_name,
                ROUND((ST_Area(ST_Intersection(boundary, ST_GeomFromGeoJSON($1))::geography)
                  / NULLIF(ST_Area(ST_GeomFromGeoJSON($1)::geography), 0) * 100)::numeric, 2)::float AS overlap_pct
         FROM field_plots
         WHERE "farmId" = $2
           AND "deletedAt" IS NULL
           AND ST_Intersects(boundary, ST_GeomFromGeoJSON($1))`,
        geojsonStr,
        farmId,
      );
      for (const ov of overlapCheck) {
        if (ov.overlap_pct > 5) {
          warnings.push(`Sobreposição de ${ov.overlap_pct}% com talhão "${ov.plot_name}"`);
        }
      }
    }

    previewFeatures.push({
      index: feature.sourceIndex,
      properties: feature.properties,
      polygon: feature.polygon,
      areaHa,
      validation: { valid: errors.length === 0, errors, warnings },
    });
  }

  // Inter-feature overlap (pairwise via turf)
  for (let i = 0; i < previewFeatures.length; i++) {
    if (!previewFeatures[i].validation.valid) continue;
    for (let j = i + 1; j < previewFeatures.length; j++) {
      if (!previewFeatures[j].validation.valid) continue;
      try {
        const polyA = turfPolygon(previewFeatures[i].polygon.coordinates as number[][][]);
        const polyB = turfPolygon(previewFeatures[j].polygon.coordinates as number[][][]);
        const inter = intersect(featureCollection([polyA, polyB]));
        if (inter) {
          const interArea = area(inter);
          const areaA = area(polyA);
          const areaB = area(polyB);
          const pctA = (interArea / areaA) * 100;
          const pctB = (interArea / areaB) * 100;
          if (pctA > 5 || pctB > 5) {
            const pct = Math.round(Math.max(pctA, pctB) * 100) / 100;
            previewFeatures[i].validation.warnings.push(
              `Sobreposição de ${pct}% com feature ${previewFeatures[j].index}`,
            );
            previewFeatures[j].validation.warnings.push(
              `Sobreposição de ${pct}% com feature ${previewFeatures[i].index}`,
            );
          }
        }
      } catch {
        // ignore intersection calculation errors
      }
    }
  }

  const validCount = previewFeatures.filter((f) => f.validation.valid).length;

  return {
    filename,
    totalFeatures: previewFeatures.length,
    validCount,
    invalidCount: previewFeatures.length - validCount,
    propertyKeys: parsed.propertyKeys,
    features: previewFeatures,
  };
}

export async function executeBulkImport(
  ctx: RlsContext,
  farmId: string,
  buffer: Buffer,
  filename: string,
  input: BulkImportInput,
  actorId: string,
): Promise<BulkImportResult> {
  const parsed = await parseGeoFileWithFeatures(buffer, filename);

  if (parsed.features.length > MAX_BULK_FEATURES) {
    throw new FarmError(
      `Arquivo contém ${parsed.features.length} features (máximo: ${MAX_BULK_FEATURES})`,
      400,
    );
  }

  const selectedSet = new Set(input.selectedIndices);
  const selectedFeatures = parsed.features.filter((f) => selectedSet.has(f.sourceIndex));

  if (selectedFeatures.length === 0) {
    throw new FarmError('Nenhuma feature selecionada para importação', 400);
  }

  const items: BulkImportResultItem[] = [];
  const warnings: string[] = [];
  let importedCount = 0;
  let skippedCount = 0;
  let nameCounter = 1;

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm || farm.deletedAt) {
      throw new FarmError('Fazenda não encontrada', 404);
    }

    // Validate registrationId
    if (input.registrationId) {
      const reg = await tx.farmRegistration.findFirst({
        where: { id: input.registrationId, farmId },
      });
      if (!reg) {
        throw new FarmError('Matrícula não pertence a esta fazenda', 400);
      }
    }

    for (const feature of selectedFeatures) {
      const result: BulkImportResultItem = { index: feature.sourceIndex, status: 'skipped' };

      // Validate geometry
      const validation = validateGeometry(feature.polygon);
      if (!validation.valid) {
        result.reason = `Geometria inválida: ${validation.errors.join('; ')}`;
        skippedCount++;
        items.push(result);
        continue;
      }

      // Resolve name from column mapping
      const mapped = applyColumnMapping(feature.properties, input.columnMapping);
      let plotName = mapped.name;
      if (!plotName) {
        if (input.defaultName) {
          plotName = input.defaultName.replace('{n}', String(nameCounter));
        } else {
          plotName = `Talhão ${nameCounter}`;
        }
      }
      nameCounter++;

      // Validate soilType
      if (mapped.soilType && !(VALID_SOIL_TYPES as readonly string[]).includes(mapped.soilType)) {
        result.reason = `Tipo de solo inválido: ${mapped.soilType}`;
        result.name = plotName;
        skippedCount++;
        items.push(result);
        continue;
      }

      const geojsonStr = JSON.stringify(feature.polygon);

      // Overlap check against DB (existing + already inserted in this batch)
      const overlapCheck = await prisma.$queryRawUnsafe<{ plot_id: string; overlap_pct: number }[]>(
        `SELECT id AS plot_id,
                ROUND((ST_Area(ST_Intersection(boundary, ST_GeomFromGeoJSON($1))::geography)
                  / NULLIF(ST_Area(ST_GeomFromGeoJSON($1)::geography), 0) * 100)::numeric, 2)::float AS overlap_pct
         FROM field_plots
         WHERE "farmId" = $2
           AND "deletedAt" IS NULL
           AND ST_Intersects(boundary, ST_GeomFromGeoJSON($1))`,
        geojsonStr,
        farmId,
      );

      const blockingOverlap = overlapCheck.find((ov) => ov.overlap_pct > 5);
      if (blockingOverlap) {
        result.reason = `Sobreposição de ${blockingOverlap.overlap_pct}% com talhão existente (máximo: 5%)`;
        result.name = plotName;
        skippedCount++;
        items.push(result);
        continue;
      }

      // Insert
      try {
        const inserted = await prisma.$queryRawUnsafe<{ id: string; area_ha: number }[]>(
          `INSERT INTO field_plots (id, "farmId", "registrationId", name, code, "soilType", "currentCrop", "previousCrop", notes, boundary, "boundaryAreaHa", status, "createdAt", "updatedAt")
           VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5::"SoilType", $6, $7, $8,
             ST_GeomFromGeoJSON($9),
             ROUND((ST_Area(ST_GeomFromGeoJSON($9)::geography) / 10000)::numeric, 4),
             'ACTIVE', now(), now()
           )
           RETURNING id, ROUND((ST_Area(boundary::geography) / 10000)::numeric, 4)::float AS area_ha`,
          farmId,
          input.registrationId ?? null,
          plotName,
          mapped.code ?? null,
          mapped.soilType ?? null,
          mapped.currentCrop ?? null,
          mapped.previousCrop ?? null,
          mapped.notes ?? null,
          geojsonStr,
        );

        const row = inserted[0];
        result.status = 'imported';
        result.plotId = row.id;
        result.name = plotName;
        result.areaHa = row.area_ha;
        importedCount++;
      } catch (err) {
        result.reason = 'Erro ao inserir talhão';
        result.name = plotName;
        skippedCount++;
        logger.error(
          { err, farmId, featureIndex: feature.sourceIndex },
          'Bulk import insert failed',
        );
      }

      items.push(result);
    }

    logger.info(
      { farmId, actorId, imported: importedCount, skipped: skippedCount },
      'Bulk import completed',
    );

    return { imported: importedCount, skipped: skippedCount, items, warnings };
  });
}

function applyColumnMapping(
  properties: Record<string, unknown>,
  mapping: ColumnMapping,
): {
  name?: string;
  code?: string;
  soilType?: string;
  currentCrop?: string;
  previousCrop?: string;
  notes?: string;
} {
  const result: Record<string, string | undefined> = {};

  if (mapping.name && properties[mapping.name] != null) {
    result.name = String(properties[mapping.name]);
  }
  if (mapping.code && properties[mapping.code] != null) {
    result.code = String(properties[mapping.code]);
  }
  if (mapping.soilType && properties[mapping.soilType] != null) {
    result.soilType = String(properties[mapping.soilType]);
  }
  if (mapping.currentCrop && properties[mapping.currentCrop] != null) {
    result.currentCrop = String(properties[mapping.currentCrop]);
  }
  if (mapping.previousCrop && properties[mapping.previousCrop] != null) {
    result.previousCrop = String(properties[mapping.previousCrop]);
  }
  if (mapping.notes && properties[mapping.notes] != null) {
    result.notes = String(properties[mapping.notes]);
  }

  return result;
}
