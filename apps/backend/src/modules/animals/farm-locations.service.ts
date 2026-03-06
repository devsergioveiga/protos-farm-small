import { prisma } from '../../database/prisma';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { parseGeoFile, validateGeometry } from '../farms/geo-parser';
import {
  FarmLocationError,
  FARM_LOCATION_TYPES,
  PASTURE_STATUSES,
  FACILITY_STATUSES,
  FORAGE_TYPES,
  FACILITY_TYPES,
  type CreateLocationInput,
  type UpdateLocationInput,
  type ListLocationsQuery,
  type LocationOccupancy,
  type OccupancyLevel,
} from './farm-locations.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateLocationType(type: string): void {
  if (!(FARM_LOCATION_TYPES as readonly string[]).includes(type)) {
    throw new FarmLocationError(`Tipo de local inválido: ${type}`, 400);
  }
}

function validateCreateInput(input: CreateLocationInput): void {
  validateLocationType(input.type);

  if (!input.name || input.name.trim().length === 0) {
    throw new FarmLocationError('Nome é obrigatório', 400);
  }

  if (input.type === 'PASTURE') {
    if (
      input.pastureStatus &&
      !(PASTURE_STATUSES as readonly string[]).includes(input.pastureStatus)
    ) {
      throw new FarmLocationError(`Status de pasto inválido: ${input.pastureStatus}`, 400);
    }
    if (input.forageType && !(FORAGE_TYPES as readonly string[]).includes(input.forageType)) {
      throw new FarmLocationError(`Tipo de forrageira inválido: ${input.forageType}`, 400);
    }
    // Reject facility-specific fields
    if (input.facilityType) {
      throw new FarmLocationError('Tipo de instalação não se aplica a pastos', 400);
    }
    if (input.facilityStatus) {
      throw new FarmLocationError('Status de instalação não se aplica a pastos', 400);
    }
  }

  if (input.type === 'FACILITY') {
    if (!input.facilityType) {
      throw new FarmLocationError('Tipo de instalação é obrigatório para instalações', 400);
    }
    if (!(FACILITY_TYPES as readonly string[]).includes(input.facilityType)) {
      throw new FarmLocationError(`Tipo de instalação inválido: ${input.facilityType}`, 400);
    }
    if (
      input.facilityStatus &&
      !(FACILITY_STATUSES as readonly string[]).includes(input.facilityStatus)
    ) {
      throw new FarmLocationError(`Status de instalação inválido: ${input.facilityStatus}`, 400);
    }
    // Reject pasture-specific fields
    if (input.forageType) {
      throw new FarmLocationError('Tipo de forrageira não se aplica a instalações', 400);
    }
    if (input.pastureStatus) {
      throw new FarmLocationError('Status de pasto não se aplica a instalações', 400);
    }
  }
}

function computeOccupancyLevel(percent: number | null): OccupancyLevel {
  if (percent == null) return 'green';
  if (percent > 90) return 'red';
  if (percent >= 70) return 'yellow';
  return 'green';
}

// ─── Create ─────────────────────────────────────────────────────────

export async function createLocation(ctx: RlsContext, farmId: string, input: CreateLocationInput) {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
    });
    if (!farm) {
      throw new FarmLocationError('Fazenda não encontrada', 404);
    }

    // Check unique name
    const existing = await tx.farmLocation.findFirst({
      where: { farmId, name: input.name.trim(), deletedAt: null },
    });
    if (existing) {
      throw new FarmLocationError(
        `Já existe um local com o nome "${input.name.trim()}" nesta fazenda`,
        409,
      );
    }

    const location = await tx.farmLocation.create({
      data: {
        farmId,
        name: input.name.trim(),
        type: input.type as never,
        capacityUA: input.capacityUA,
        capacityAnimals: input.capacityAnimals,
        forageType: (input.forageType as never) ?? null,
        pastureStatus:
          (input.pastureStatus as never) ?? (input.type === 'PASTURE' ? ('EM_USO' as never) : null),
        facilityType: (input.facilityType as never) ?? null,
        facilityStatus:
          (input.facilityStatus as never) ??
          (input.type === 'FACILITY' ? ('ATIVO' as never) : null),
        description: input.description,
        notes: input.notes,
      },
      include: { _count: { select: { lots: true } } },
    });

    return location;
  });
}

// ─── List ───────────────────────────────────────────────────────────

export async function listLocations(ctx: RlsContext, farmId: string, query: ListLocationsQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
    });
    if (!farm) {
      throw new FarmLocationError('Fazenda não encontrada', 404);
    }

    const where: Record<string, unknown> = { farmId, deletedAt: null };

    if (query.type) {
      validateLocationType(query.type);
      where.type = query.type;
    }

    if (query.pastureStatus) {
      where.pastureStatus = query.pastureStatus;
    }

    if (query.facilityStatus) {
      where.facilityStatus = query.facilityStatus;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [locations, total] = await Promise.all([
      tx.farmLocation.findMany({
        where,
        include: { _count: { select: { lots: true } } },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      tx.farmLocation.count({ where }),
    ]);

    return {
      data: locations,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── Get ────────────────────────────────────────────────────────────

export async function getLocation(ctx: RlsContext, farmId: string, locationId: string) {
  return withRlsContext(ctx, async (tx) => {
    const location = await tx.farmLocation.findFirst({
      where: { id: locationId, farmId, deletedAt: null },
      include: {
        _count: { select: { lots: true, animals: true } },
        lots: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            predominantCategory: true,
            _count: { select: { animals: true } },
          },
        },
      },
    });
    if (!location) {
      throw new FarmLocationError('Local não encontrado', 404);
    }
    return location;
  });
}

// ─── Update ─────────────────────────────────────────────────────────

export async function updateLocation(
  ctx: RlsContext,
  farmId: string,
  locationId: string,
  input: UpdateLocationInput,
) {
  return withRlsContext(ctx, async (tx) => {
    const location = await tx.farmLocation.findFirst({
      where: { id: locationId, farmId, deletedAt: null },
    });
    if (!location) {
      throw new FarmLocationError('Local não encontrado', 404);
    }

    // Check unique name if updating
    if (input.name && input.name.trim() !== location.name) {
      const existing = await tx.farmLocation.findFirst({
        where: { farmId, name: input.name.trim(), deletedAt: null, id: { not: locationId } },
      });
      if (existing) {
        throw new FarmLocationError(
          `Já existe um local com o nome "${input.name.trim()}" nesta fazenda`,
          409,
        );
      }
    }

    // Validate type-specific fields based on existing type
    if (location.type === 'PASTURE') {
      if (
        input.pastureStatus &&
        !(PASTURE_STATUSES as readonly string[]).includes(input.pastureStatus)
      ) {
        throw new FarmLocationError(`Status de pasto inválido: ${input.pastureStatus}`, 400);
      }
      if (input.forageType && !(FORAGE_TYPES as readonly string[]).includes(input.forageType)) {
        throw new FarmLocationError(`Tipo de forrageira inválido: ${input.forageType}`, 400);
      }
    }

    if (location.type === 'FACILITY') {
      if (
        input.facilityType &&
        !(FACILITY_TYPES as readonly string[]).includes(input.facilityType)
      ) {
        throw new FarmLocationError(`Tipo de instalação inválido: ${input.facilityType}`, 400);
      }
      if (
        input.facilityStatus &&
        !(FACILITY_STATUSES as readonly string[]).includes(input.facilityStatus)
      ) {
        throw new FarmLocationError(`Status de instalação inválido: ${input.facilityStatus}`, 400);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.capacityUA !== undefined) data.capacityUA = input.capacityUA;
    if (input.capacityAnimals !== undefined) data.capacityAnimals = input.capacityAnimals;
    if (input.forageType !== undefined) data.forageType = input.forageType as never;
    if (input.pastureStatus !== undefined) data.pastureStatus = input.pastureStatus as never;
    if (input.facilityType !== undefined) data.facilityType = input.facilityType as never;
    if (input.facilityStatus !== undefined) data.facilityStatus = input.facilityStatus as never;
    if (input.description !== undefined) data.description = input.description;
    if (input.notes !== undefined) data.notes = input.notes;

    const updated = await tx.farmLocation.update({
      where: { id: locationId },
      data,
      include: { _count: { select: { lots: true } } },
    });

    return updated;
  });
}

// ─── Soft Delete ────────────────────────────────────────────────────

export async function softDeleteLocation(ctx: RlsContext, farmId: string, locationId: string) {
  return withRlsContext(ctx, async (tx) => {
    const location = await tx.farmLocation.findFirst({
      where: { id: locationId, farmId, deletedAt: null },
    });
    if (!location) {
      throw new FarmLocationError('Local não encontrado', 404);
    }

    // Unlink lots
    await tx.animalLot.updateMany({
      where: { locationId },
      data: { locationId: null },
    });

    // Unlink animals
    await tx.animal.updateMany({
      where: { pastureId: locationId },
      data: { pastureId: null },
    });

    await tx.farmLocation.update({
      where: { id: locationId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── Upload Boundary ────────────────────────────────────────────────

export async function uploadLocationBoundary(
  ctx: RlsContext,
  farmId: string,
  locationId: string,
  buffer: Buffer,
  filename: string,
) {
  const parsed = await parseGeoFile(buffer, filename);
  const geometry = parsed.boundaries[0];
  const warnings = [...parsed.warnings];

  if (!geometry) {
    throw new FarmLocationError('Nenhuma geometria encontrada no arquivo', 400);
  }

  if (parsed.boundaries.length > 1) {
    warnings.push('Múltiplos polígonos encontrados; usando o primeiro');
  }

  const validation = validateGeometry(geometry);
  if (!validation.valid) {
    throw new FarmLocationError(`Geometria inválida: ${validation.errors.join('; ')}`, 400);
  }

  const geojsonStr = JSON.stringify(geometry);

  return withRlsContext(ctx, async (tx) => {
    const location = await tx.farmLocation.findFirst({
      where: { id: locationId, farmId, deletedAt: null },
    });
    if (!location) {
      throw new FarmLocationError('Local não encontrado', 404);
    }

    // Insert boundary and calculate area using PostGIS
    const result = await prisma.$queryRawUnsafe<{ area_ha: number }[]>(
      `UPDATE farm_locations
       SET boundary = ST_GeomFromGeoJSON($1),
           "boundaryAreaHa" = ROUND((ST_Area(ST_GeomFromGeoJSON($1)::geography) / 10000)::numeric, 4),
           "updatedAt" = now()
       WHERE id = $2
       RETURNING ROUND((ST_Area(boundary::geography) / 10000)::numeric, 4)::float AS area_ha`,
      geojsonStr,
      locationId,
    );

    const boundaryAreaHa = result[0]?.area_ha ?? 0;

    return { boundaryAreaHa, warnings };
  });
}

// ─── Get Boundary ───────────────────────────────────────────────────

export async function getLocationBoundary(ctx: RlsContext, farmId: string, locationId: string) {
  return withRlsContext(ctx, async (tx) => {
    const location = await tx.farmLocation.findFirst({
      where: { id: locationId, farmId, deletedAt: null },
    });
    if (!location) {
      throw new FarmLocationError('Local não encontrado', 404);
    }

    const rows = await prisma.$queryRawUnsafe<{ geojson: string | null; area_ha: number | null }[]>(
      `SELECT ST_AsGeoJSON(boundary)::text AS geojson, "boundaryAreaHa"::float AS area_ha
       FROM farm_locations WHERE id = $1`,
      locationId,
    );

    const row = rows[0];
    if (!row?.geojson) {
      return { hasBoundary: false, boundaryAreaHa: null, boundaryGeoJSON: null };
    }

    return {
      hasBoundary: true,
      boundaryAreaHa: row.area_ha,
      boundaryGeoJSON: JSON.parse(row.geojson),
    };
  });
}

// ─── Delete Boundary ────────────────────────────────────────────────

export async function deleteLocationBoundary(ctx: RlsContext, farmId: string, locationId: string) {
  return withRlsContext(ctx, async (tx) => {
    const location = await tx.farmLocation.findFirst({
      where: { id: locationId, farmId, deletedAt: null },
    });
    if (!location) {
      throw new FarmLocationError('Local não encontrado', 404);
    }

    await prisma.$executeRawUnsafe(
      `UPDATE farm_locations SET boundary = NULL, "boundaryAreaHa" = NULL, "updatedAt" = now() WHERE id = $1`,
      locationId,
    );
  });
}

// ─── Occupancy ──────────────────────────────────────────────────────

export async function getLocationOccupancy(
  ctx: RlsContext,
  farmId: string,
  locationId: string,
): Promise<LocationOccupancy> {
  return withRlsContext(ctx, async (tx) => {
    const location = await tx.farmLocation.findFirst({
      where: { id: locationId, farmId, deletedAt: null },
    });
    if (!location) {
      throw new FarmLocationError('Local não encontrado', 404);
    }

    // Count animals in lots linked to this location
    const animalCount = await tx.animal.count({
      where: {
        deletedAt: null,
        lot: { locationId, deletedAt: null },
      },
    });

    // Also count animals directly in this pasture
    const directAnimalCount = await tx.animal.count({
      where: {
        pastureId: locationId,
        deletedAt: null,
      },
    });

    const totalAnimals = animalCount + directAnimalCount;
    const capacityUA = location.capacityUA ? Number(location.capacityUA) : null;
    const capacityAnimals = location.capacityAnimals;

    let occupancyPercent: number | null = null;
    if (capacityAnimals && capacityAnimals > 0) {
      occupancyPercent = Math.round((totalAnimals / capacityAnimals) * 100);
    } else if (capacityUA && capacityUA > 0) {
      // Approximate: 1 animal = 1 UA for simplicity
      occupancyPercent = Math.round((totalAnimals / capacityUA) * 100);
    }

    return {
      totalAnimals,
      capacityUA,
      capacityAnimals,
      occupancyPercent,
      level: computeOccupancyLevel(occupancyPercent),
    };
  });
}

// ─── List for Map ───────────────────────────────────────────────────

export async function listLocationsForMap(ctx: RlsContext, farmId: string) {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
    });
    if (!farm) {
      throw new FarmLocationError('Fazenda não encontrada', 404);
    }

    // Single query: get all locations with boundary GeoJSON and animal counts
    const rows = await prisma.$queryRawUnsafe<
      {
        id: string;
        name: string;
        type: string;
        boundary_geojson: string | null;
        boundary_area_ha: number | null;
        capacity_ua: number | null;
        capacity_animals: number | null;
        forage_type: string | null;
        pasture_status: string | null;
        facility_type: string | null;
        facility_status: string | null;
        description: string | null;
      }[]
    >(
      `SELECT
         fl.id,
         fl.name,
         fl.type::text,
         ST_AsGeoJSON(fl.boundary)::text AS boundary_geojson,
         fl."boundaryAreaHa"::float AS boundary_area_ha,
         fl."capacityUA"::float AS capacity_ua,
         fl."capacityAnimals" AS capacity_animals,
         fl."forageType"::text AS forage_type,
         fl."pastureStatus"::text AS pasture_status,
         fl."facilityType"::text AS facility_type,
         fl."facilityStatus"::text AS facility_status,
         fl.description
       FROM farm_locations fl
       WHERE fl."farmId" = $1 AND fl."deletedAt" IS NULL
       ORDER BY fl.name`,
      farmId,
    );

    // Get animal counts per location (via lots + direct pasture)
    const locationIds = rows.map((r) => r.id);

    let lotAnimalCounts: Map<string, number> = new Map();
    let directAnimalCounts: Map<string, number> = new Map();

    if (locationIds.length > 0) {
      // Animals via lots
      const lotCounts = await prisma.$queryRawUnsafe<{ location_id: string; count: string }[]>(
        `SELECT al."locationId" AS location_id, COUNT(a.id)::text AS count
         FROM animal_lots al
         JOIN animals a ON a."lotId" = al.id AND a."deletedAt" IS NULL
         WHERE al."locationId" = ANY($1::text[]) AND al."deletedAt" IS NULL
         GROUP BY al."locationId"`,
        locationIds,
      );
      lotAnimalCounts = new Map(lotCounts.map((r) => [r.location_id, parseInt(r.count, 10)]));

      // Animals directly in pasture
      const directCounts = await prisma.$queryRawUnsafe<{ pasture_id: string; count: string }[]>(
        `SELECT "pastureId" AS pasture_id, COUNT(id)::text AS count
         FROM animals
         WHERE "pastureId" = ANY($1::text[]) AND "deletedAt" IS NULL
         GROUP BY "pastureId"`,
        locationIds,
      );
      directAnimalCounts = new Map(directCounts.map((r) => [r.pasture_id, parseInt(r.count, 10)]));
    }

    return rows.map((row) => {
      const totalAnimals =
        (lotAnimalCounts.get(row.id) ?? 0) + (directAnimalCounts.get(row.id) ?? 0);
      const capacityAnimals = row.capacity_animals;
      const capacityUA = row.capacity_ua;

      let occupancyPercent: number | null = null;
      if (capacityAnimals && capacityAnimals > 0) {
        occupancyPercent = Math.round((totalAnimals / capacityAnimals) * 100);
      } else if (capacityUA && capacityUA > 0) {
        occupancyPercent = Math.round((totalAnimals / capacityUA) * 100);
      }

      return {
        id: row.id,
        name: row.name,
        type: row.type,
        boundaryGeoJSON: row.boundary_geojson ? JSON.parse(row.boundary_geojson) : null,
        boundaryAreaHa: row.boundary_area_ha,
        capacityUA: row.capacity_ua,
        capacityAnimals: row.capacity_animals,
        forageType: row.forage_type,
        pastureStatus: row.pasture_status,
        facilityType: row.facility_type,
        facilityStatus: row.facility_status,
        description: row.description,
        occupancy: {
          totalAnimals,
          capacityUA: row.capacity_ua,
          capacityAnimals: row.capacity_animals,
          occupancyPercent,
          level: computeOccupancyLevel(occupancyPercent),
        },
      };
    });
  });
}
