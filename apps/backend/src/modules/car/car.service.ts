import { withRlsContext, type RlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import { logger } from '../../shared/utils/logger';
import {
  CarError,
  CAR_STATUSES,
  VALID_UF,
  type CreateCarInput,
  type UpdateCarInput,
  type BoundaryUploadResult,
  type BoundaryInfo,
} from './car.types';
import { parseGeoFile, validateGeometry } from '../farms/geo-parser';

// ─── Helpers ─────────────────────────────────────────────────────────

function validateUf(uf: string): boolean {
  return (VALID_UF as readonly string[]).includes(uf.toUpperCase());
}

function validateStatus(status: string): boolean {
  return (CAR_STATUSES as readonly string[]).includes(status);
}

// ─── Select helpers ──────────────────────────────────────────────────

const carSelect = {
  id: true,
  farmId: true,
  carCode: true,
  status: true,
  inscriptionDate: true,
  lastRectificationDate: true,
  areaHa: true,
  modulosFiscais: true,
  city: true,
  state: true,
  nativeVegetationHa: true,
  consolidatedAreaHa: true,
  administrativeEasementHa: true,
  legalReserveRecordedHa: true,
  legalReserveApprovedHa: true,
  legalReserveProposedHa: true,
  appTotalHa: true,
  appConsolidatedHa: true,
  appNativeVegetationHa: true,
  restrictedUseHa: true,
  legalReserveSurplusDeficit: true,
  legalReserveToRestoreHa: true,
  appToRestoreHa: true,
  restrictedUseToRestoreHa: true,
  boundaryAreaHa: true,
  createdAt: true,
  updatedAt: true,
  registrationLinks: {
    select: {
      id: true,
      farmRegistrationId: true,
      farmRegistration: {
        select: { id: true, number: true, areaHa: true, state: true },
      },
    },
  },
};

// ─── Create CAR ──────────────────────────────────────────────────────

export async function createCar(ctx: RlsContext, farmId: string, input: CreateCarInput) {
  if (!input.carCode?.trim()) {
    throw new CarError('Código do CAR é obrigatório', 400);
  }

  if (input.status && !validateStatus(input.status)) {
    throw new CarError(`Status inválido. Valores aceitos: ${CAR_STATUSES.join(', ')}`, 400);
  }

  if (input.state && !validateUf(input.state)) {
    throw new CarError('UF inválida', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new CarError('Fazenda não encontrada', 404);
    }

    // Validate registrationIds belong to this farm
    if (input.registrationIds?.length) {
      const regs = await tx.farmRegistration.findMany({
        where: { id: { in: input.registrationIds }, farmId },
        select: { id: true },
      });
      const foundIds = new Set(regs.map((r) => r.id));
      for (const regId of input.registrationIds) {
        if (!foundIds.has(regId)) {
          throw new CarError(`Matrícula ${regId} não encontrada nesta fazenda`, 404);
        }
      }
    }

    const { registrationIds, ...carData } = input;

    const car = await tx.carRegistration.create({
      data: {
        ...carData,
        carCode: carData.carCode.trim(),
        status: (carData.status as 'ATIVO' | 'PENDENTE' | 'CANCELADO' | 'SUSPENSO') ?? 'ATIVO',
        inscriptionDate: carData.inscriptionDate ? new Date(carData.inscriptionDate) : undefined,
        lastRectificationDate: carData.lastRectificationDate
          ? new Date(carData.lastRectificationDate)
          : undefined,
        farmId,
        registrationLinks: registrationIds?.length
          ? {
              create: registrationIds.map((farmRegistrationId) => ({
                farmRegistrationId,
              })),
            }
          : undefined,
      },
      select: carSelect,
    });

    logger.info({ farmId, carId: car.id }, 'CAR created');
    return car;
  });
}

// ─── List CARs ───────────────────────────────────────────────────────

export async function listCars(ctx: RlsContext, farmId: string) {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new CarError('Fazenda não encontrada', 404);
    }

    const cars = await tx.carRegistration.findMany({
      where: { farmId },
      select: carSelect,
      orderBy: { createdAt: 'desc' },
    });

    return cars;
  });
}

// ─── Get CAR ─────────────────────────────────────────────────────────

export async function getCar(ctx: RlsContext, farmId: string, carId: string) {
  return withRlsContext(ctx, async (tx) => {
    const car = await tx.carRegistration.findFirst({
      where: { id: carId, farmId },
      select: carSelect,
    });

    if (!car) {
      throw new CarError('CAR não encontrado', 404);
    }

    return car;
  });
}

// ─── Update CAR ──────────────────────────────────────────────────────

export async function updateCar(
  ctx: RlsContext,
  farmId: string,
  carId: string,
  input: UpdateCarInput,
) {
  if (input.status && !validateStatus(input.status)) {
    throw new CarError(`Status inválido. Valores aceitos: ${CAR_STATUSES.join(', ')}`, 400);
  }

  if (input.state && !validateUf(input.state)) {
    throw new CarError('UF inválida', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.carRegistration.findFirst({
      where: { id: carId, farmId },
    });
    if (!existing) {
      throw new CarError('CAR não encontrado', 404);
    }

    // Validate registrationIds if provided
    if (input.registrationIds) {
      if (input.registrationIds.length) {
        const regs = await tx.farmRegistration.findMany({
          where: { id: { in: input.registrationIds }, farmId },
          select: { id: true },
        });
        const foundIds = new Set(regs.map((r) => r.id));
        for (const regId of input.registrationIds) {
          if (!foundIds.has(regId)) {
            throw new CarError(`Matrícula ${regId} não encontrada nesta fazenda`, 404);
          }
        }
      }

      // Delete + recreate links
      await tx.carRegistrationLink.deleteMany({
        where: { carRegistrationId: carId },
      });

      if (input.registrationIds.length) {
        await tx.carRegistrationLink.createMany({
          data: input.registrationIds.map((farmRegistrationId) => ({
            carRegistrationId: carId,
            farmRegistrationId,
          })),
        });
      }
    }

    const updated = await tx.carRegistration.update({
      where: { id: carId },
      data: {
        carCode: input.carCode?.trim(),
        status: input.status as 'ATIVO' | 'PENDENTE' | 'CANCELADO' | 'SUSPENSO' | undefined,
        areaHa: input.areaHa,
        modulosFiscais: input.modulosFiscais,
        city: input.city,
        state: input.state,
        nativeVegetationHa: input.nativeVegetationHa,
        consolidatedAreaHa: input.consolidatedAreaHa,
        administrativeEasementHa: input.administrativeEasementHa,
        legalReserveRecordedHa: input.legalReserveRecordedHa,
        legalReserveApprovedHa: input.legalReserveApprovedHa,
        legalReserveProposedHa: input.legalReserveProposedHa,
        appTotalHa: input.appTotalHa,
        appConsolidatedHa: input.appConsolidatedHa,
        appNativeVegetationHa: input.appNativeVegetationHa,
        restrictedUseHa: input.restrictedUseHa,
        legalReserveSurplusDeficit: input.legalReserveSurplusDeficit,
        legalReserveToRestoreHa: input.legalReserveToRestoreHa,
        appToRestoreHa: input.appToRestoreHa,
        restrictedUseToRestoreHa: input.restrictedUseToRestoreHa,
        inscriptionDate:
          input.inscriptionDate !== undefined
            ? input.inscriptionDate
              ? new Date(input.inscriptionDate)
              : null
            : undefined,
        lastRectificationDate:
          input.lastRectificationDate !== undefined
            ? input.lastRectificationDate
              ? new Date(input.lastRectificationDate)
              : null
            : undefined,
      },
      select: carSelect,
    });

    logger.info({ farmId, carId }, 'CAR updated');
    return updated;
  });
}

// ─── Delete CAR ──────────────────────────────────────────────────────

export async function deleteCar(ctx: RlsContext, farmId: string, carId: string) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.carRegistration.findFirst({
      where: { id: carId, farmId },
    });
    if (!existing) {
      throw new CarError('CAR não encontrado', 404);
    }

    await tx.carRegistration.delete({ where: { id: carId } });

    logger.info({ farmId, carId }, 'CAR deleted');
  });
}

// ─── Upload CAR Boundary ─────────────────────────────────────────────

export async function uploadCarBoundary(
  ctx: RlsContext,
  farmId: string,
  carId: string,
  buffer: Buffer,
  filename: string,
): Promise<BoundaryUploadResult> {
  const parsed = await parseGeoFile(buffer, filename);
  const polygon = parsed.boundaries[0];
  const warnings = [...parsed.warnings];

  if (parsed.boundaries.length > 1) {
    warnings.push('Múltiplos polígonos encontrados; usando o primeiro');
  }

  const validation = validateGeometry(polygon);
  if (!validation.valid) {
    throw new CarError(`Geometria inválida: ${validation.errors.join('; ')}`, 400);
  }

  const geojsonStr = JSON.stringify(polygon);

  return withRlsContext(ctx, async (tx) => {
    const car = await tx.carRegistration.findFirst({
      where: { id: carId, farmId },
    });
    if (!car) {
      throw new CarError('CAR não encontrado', 404);
    }

    // Insert boundary and calculate area using PostGIS
    const result = await prisma.$queryRawUnsafe<{ area_ha: number; is_valid: boolean }[]>(
      `UPDATE car_registrations
       SET boundary = ST_GeomFromGeoJSON($1),
           "boundaryAreaHa" = ROUND((ST_Area(ST_GeomFromGeoJSON($1)::geography) / 10000)::numeric, 4)
       WHERE id = $2
       RETURNING
         ROUND((ST_Area(boundary::geography) / 10000)::numeric, 4)::float AS area_ha,
         ST_IsValid(boundary) AS is_valid`,
      geojsonStr,
      carId,
    );

    const boundaryAreaHa = result[0].area_ha;

    if (!result[0].is_valid) {
      warnings.push('PostGIS marcou a geometria como inválida (ST_IsValid=false)');
    }

    // Compare with areaHa if set
    const refAreaHa = car.areaHa ? Number(car.areaHa) : 0;
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
          `Divergência de ${percentage}% entre área do perímetro (${boundaryAreaHa} ha) e área do CAR (${refAreaHa} ha)`,
        );
      }
    }

    logger.info({ farmId, carId, boundaryAreaHa }, 'CAR boundary uploaded');

    return { boundaryAreaHa, areaDivergence, warnings };
  });
}

// ─── Get CAR Boundary ────────────────────────────────────────────────

export async function getCarBoundary(
  ctx: RlsContext,
  farmId: string,
  carId: string,
): Promise<BoundaryInfo> {
  return withRlsContext(ctx, async (tx) => {
    const car = await tx.carRegistration.findFirst({
      where: { id: carId, farmId },
    });
    if (!car) {
      throw new CarError('CAR não encontrado', 404);
    }

    const rows = await prisma.$queryRawUnsafe<{ geojson: string | null; area_ha: number | null }[]>(
      `SELECT ST_AsGeoJSON(boundary)::text AS geojson, "boundaryAreaHa"::float AS area_ha
       FROM car_registrations WHERE id = $1`,
      carId,
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

// ─── Delete CAR Boundary ─────────────────────────────────────────────

export async function deleteCarBoundary(
  ctx: RlsContext,
  farmId: string,
  carId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const car = await tx.carRegistration.findFirst({
      where: { id: carId, farmId },
    });
    if (!car) {
      throw new CarError('CAR não encontrado', 404);
    }

    await prisma.$executeRawUnsafe(
      `UPDATE car_registrations SET boundary = NULL, "boundaryAreaHa" = NULL WHERE id = $1`,
      carId,
    );

    logger.info({ farmId, carId }, 'CAR boundary deleted');
  });
}
