import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  AssetError,
  type CreateAssetInput,
  type UpdateAssetInput,
  type ListAssetsQuery,
  type AssetMapItem,
} from './assets.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ─────────────────────────────────────────────────────────

async function getNextAssetTag(tx: TxClient, organizationId: string): Promise<string> {
  const last = await tx.asset.findFirst({
    where: { organizationId, assetTag: { startsWith: 'PAT-' } },
    orderBy: { assetTag: 'desc' },
    select: { assetTag: true },
  });

  let lastNum = 0;
  if (last?.assetTag) {
    const num = parseInt(last.assetTag.replace('PAT-', ''), 10);
    if (!isNaN(num)) lastNum = num;
  }

  return `PAT-${String(lastNum + 1).padStart(5, '0')}`;
}

const ASSET_INCLUDE = {
  farm: { select: { name: true } },
  supplier: { select: { name: true } },
  costCenter: { select: { name: true } },
  parentAsset: { select: { id: true, name: true, assetTag: true } },
};

const ASSET_INCLUDE_FULL = {
  ...ASSET_INCLUDE,
  childAssets: { select: { id: true, name: true, assetTag: true, assetType: true, status: true } },
  _count: { select: { fuelRecords: true, meterReadings: true, documents: true } },
};

// ─── Service functions ────────────────────────────────────────────────

export async function createAsset(ctx: RlsContext, input: CreateAssetInput) {
  return prisma.$transaction(async (tx) => {
    const assetTag = await getNextAssetTag(tx, ctx.organizationId);

    // Validate IMPLEMENTO parent
    if (input.assetType === 'IMPLEMENTO' && input.parentAssetId) {
      const parent = await tx.asset.findFirst({
        where: { id: input.parentAssetId, organizationId: ctx.organizationId, deletedAt: null },
        select: { assetType: true },
      });
      if (!parent) {
        throw new AssetError('Ativo pai não encontrado', 404);
      }
      if (parent.assetType !== 'MAQUINA') {
        throw new AssetError('Implemento só pode ser vinculado a uma máquina', 400);
      }
    }

    // Force TERRA to NON_DEPRECIABLE_CPC27
    const classification =
      input.assetType === 'TERRA' ? 'NON_DEPRECIABLE_CPC27' : input.classification;

    // Build geo data
    let geoPointRaw: string | undefined;
    if (input.assetType === 'BENFEITORIA' && input.geoLat != null && input.geoLon != null) {
      geoPointRaw = `ST_SetSRID(ST_MakePoint(${input.geoLon}, ${input.geoLat}), 4326)`;
    }

    if (geoPointRaw) {
      // Use raw SQL for geoPoint
      const created = await tx.asset.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: input.farmId,
          assetType: input.assetType as never,
          classification: classification as never,
          name: input.name,
          description: input.description,
          assetTag,
          acquisitionDate: input.acquisitionDate ? new Date(input.acquisitionDate) : undefined,
          acquisitionValue:
            input.acquisitionValue != null ? String(input.acquisitionValue) : undefined,
          supplierId: input.supplierId,
          invoiceNumber: input.invoiceNumber,
          costCenterId: input.costCenterId,
          costCenterMode: input.costCenterMode ?? 'FIXED',
          costCenterPercent:
            input.costCenterPercent != null ? String(input.costCenterPercent) : undefined,
          serialNumber: input.serialNumber,
          manufacturer: input.manufacturer,
          model: input.model,
          yearOfManufacture: input.yearOfManufacture,
          engineHp: input.engineHp != null ? String(input.engineHp) : undefined,
          fuelType: input.fuelType,
          renavamCode: input.renavamCode,
          licensePlate: input.licensePlate,
          parentAssetId: input.parentAssetId,
          constructionMaterial: input.constructionMaterial,
          areaM2: input.areaM2 != null ? String(input.areaM2) : undefined,
          capacity: input.capacity,
          registrationNumber: input.registrationNumber,
          areaHa: input.areaHa != null ? String(input.areaHa) : undefined,
          carCode: input.carCode,
          currentHourmeter:
            input.currentHourmeter != null ? String(input.currentHourmeter) : undefined,
          currentOdometer:
            input.currentOdometer != null ? String(input.currentOdometer) : undefined,
          photoUrls: [],
          notes: input.notes,
        },
        include: ASSET_INCLUDE,
      });

      // Update geoPoint via raw SQL
      await tx.$executeRawUnsafe(
        `UPDATE assets SET "geoPoint" = ${geoPointRaw} WHERE id = '${created.id}'`,
      );

      return created;
    }

    return tx.asset.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        assetType: input.assetType as never,
        classification: classification as never,
        name: input.name,
        description: input.description,
        assetTag,
        acquisitionDate: input.acquisitionDate ? new Date(input.acquisitionDate) : undefined,
        acquisitionValue:
          input.acquisitionValue != null ? String(input.acquisitionValue) : undefined,
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber,
        costCenterId: input.costCenterId,
        costCenterMode: input.costCenterMode ?? 'FIXED',
        costCenterPercent:
          input.costCenterPercent != null ? String(input.costCenterPercent) : undefined,
        serialNumber: input.serialNumber,
        manufacturer: input.manufacturer,
        model: input.model,
        yearOfManufacture: input.yearOfManufacture,
        engineHp: input.engineHp != null ? String(input.engineHp) : undefined,
        fuelType: input.fuelType,
        renavamCode: input.renavamCode,
        licensePlate: input.licensePlate,
        parentAssetId: input.parentAssetId,
        constructionMaterial: input.constructionMaterial,
        areaM2: input.areaM2 != null ? String(input.areaM2) : undefined,
        capacity: input.capacity,
        registrationNumber: input.registrationNumber,
        areaHa: input.areaHa != null ? String(input.areaHa) : undefined,
        carCode: input.carCode,
        currentHourmeter:
          input.currentHourmeter != null ? String(input.currentHourmeter) : undefined,
        currentOdometer: input.currentOdometer != null ? String(input.currentOdometer) : undefined,
        photoUrls: [],
        notes: input.notes,
      },
      include: ASSET_INCLUDE,
    });
  });
}

export async function listAssets(ctx: RlsContext, query: ListAssetsQuery) {
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 20), 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };

  if (query.farmId) where['farmId'] = query.farmId;
  if (query.assetType) where['assetType'] = query.assetType;
  if (query.status) where['status'] = query.status;

  if (query.search) {
    where['OR'] = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { assetTag: { contains: query.search, mode: 'insensitive' } },
      { serialNumber: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.minValue != null || query.maxValue != null) {
    const valueFilter: Record<string, unknown> = {};
    if (query.minValue != null) valueFilter['gte'] = String(query.minValue);
    if (query.maxValue != null) valueFilter['lte'] = String(query.maxValue);
    where['acquisitionValue'] = valueFilter;
  }

  if (query.acquisitionFrom || query.acquisitionTo) {
    const dateFilter: Record<string, unknown> = {};
    if (query.acquisitionFrom) dateFilter['gte'] = new Date(query.acquisitionFrom);
    if (query.acquisitionTo) dateFilter['lte'] = new Date(query.acquisitionTo);
    where['acquisitionDate'] = dateFilter;
  }

  const orderBy: Record<string, string> = {};
  if (query.sortBy) {
    orderBy[query.sortBy] = query.sortOrder ?? 'desc';
  } else {
    orderBy['createdAt'] = 'desc';
  }

  const [data, total] = await Promise.all([
    prisma.asset.findMany({
      where: where as never,
      include: ASSET_INCLUDE,
      orderBy: orderBy as never,
      skip,
      take: limit,
    }),
    prisma.asset.count({ where: where as never }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getAsset(ctx: RlsContext, assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    include: ASSET_INCLUDE_FULL,
  });

  if (!asset) {
    throw new AssetError('Ativo não encontrado', 404);
  }

  return asset;
}

export async function updateAsset(ctx: RlsContext, assetId: string, input: UpdateAssetInput) {
  const existing = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
  });

  if (!existing) {
    throw new AssetError('Ativo não encontrado', 404);
  }

  // Validate IMPLEMENTO parent if changing parentAssetId
  if (input.parentAssetId && input.parentAssetId !== existing.parentAssetId) {
    const assetType = input.assetType ?? String(existing.assetType);
    if (assetType === 'IMPLEMENTO') {
      const parent = await prisma.asset.findFirst({
        where: { id: input.parentAssetId, organizationId: ctx.organizationId, deletedAt: null },
        select: { assetType: true },
      });
      if (!parent) {
        throw new AssetError('Ativo pai não encontrado', 404);
      }
      if (parent.assetType !== 'MAQUINA') {
        throw new AssetError('Implemento só pode ser vinculado a uma máquina', 400);
      }
    }
  }

  // Force TERRA classification
  const assetType = input.assetType ?? String(existing.assetType);
  const classification =
    assetType === 'TERRA'
      ? 'NON_DEPRECIABLE_CPC27'
      : (input.classification ?? String(existing.classification));

  // Handle geoPoint update
  const hasGeoUpdate = input.geoLat != null && input.geoLon != null;

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.assetType !== undefined && { assetType: input.assetType as never }),
      ...(input.classification !== undefined && { classification: classification as never }),
      ...(input.status !== undefined && { status: input.status as never }),
      ...(input.farmId !== undefined && { farmId: input.farmId }),
      ...(input.acquisitionDate !== undefined && {
        acquisitionDate: new Date(input.acquisitionDate),
      }),
      ...(input.acquisitionValue != null && { acquisitionValue: String(input.acquisitionValue) }),
      ...(input.supplierId !== undefined && { supplierId: input.supplierId }),
      ...(input.invoiceNumber !== undefined && { invoiceNumber: input.invoiceNumber }),
      ...(input.costCenterId !== undefined && { costCenterId: input.costCenterId }),
      ...(input.costCenterMode !== undefined && { costCenterMode: input.costCenterMode }),
      ...(input.costCenterPercent != null && {
        costCenterPercent: String(input.costCenterPercent),
      }),
      ...(input.serialNumber !== undefined && { serialNumber: input.serialNumber }),
      ...(input.manufacturer !== undefined && { manufacturer: input.manufacturer }),
      ...(input.model !== undefined && { model: input.model }),
      ...(input.yearOfManufacture !== undefined && { yearOfManufacture: input.yearOfManufacture }),
      ...(input.engineHp != null && { engineHp: String(input.engineHp) }),
      ...(input.fuelType !== undefined && { fuelType: input.fuelType }),
      ...(input.renavamCode !== undefined && { renavamCode: input.renavamCode }),
      ...(input.licensePlate !== undefined && { licensePlate: input.licensePlate }),
      ...(input.parentAssetId !== undefined && { parentAssetId: input.parentAssetId }),
      ...(input.constructionMaterial !== undefined && {
        constructionMaterial: input.constructionMaterial,
      }),
      ...(input.areaM2 != null && { areaM2: String(input.areaM2) }),
      ...(input.capacity !== undefined && { capacity: input.capacity }),
      ...(input.registrationNumber !== undefined && {
        registrationNumber: input.registrationNumber,
      }),
      ...(input.areaHa != null && { areaHa: String(input.areaHa) }),
      ...(input.carCode !== undefined && { carCode: input.carCode }),
      ...(input.currentHourmeter != null && { currentHourmeter: String(input.currentHourmeter) }),
      ...(input.currentOdometer != null && { currentOdometer: String(input.currentOdometer) }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
    include: ASSET_INCLUDE,
  });

  if (hasGeoUpdate) {
    await prisma.$executeRawUnsafe(
      `UPDATE assets SET "geoPoint" = ST_SetSRID(ST_MakePoint(${input.geoLon!}, ${input.geoLat!}), 4326) WHERE id = '${assetId}'`,
    );
  }

  return updated;
}

export async function deleteAsset(ctx: RlsContext, assetId: string) {
  const existing = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
  });

  if (!existing) {
    throw new AssetError('Ativo não encontrado', 404);
  }

  return prisma.asset.update({
    where: { id: assetId },
    data: { deletedAt: new Date() },
    include: ASSET_INCLUDE,
  });
}

export async function getAssetSummary(ctx: RlsContext) {
  const baseWhere = { organizationId: ctx.organizationId, deletedAt: null };

  const [totalAssets, inMaintenance, totalValueResult, recentAcquisitions] = await Promise.all([
    prisma.asset.count({ where: baseWhere }),
    prisma.asset.count({ where: { ...baseWhere, status: 'EM_MANUTENCAO' } }),
    prisma.asset.aggregate({
      where: baseWhere,
      _sum: { acquisitionValue: true },
    }),
    prisma.asset.findMany({
      where: baseWhere,
      orderBy: { acquisitionDate: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        assetTag: true,
        assetType: true,
        acquisitionDate: true,
        acquisitionValue: true,
      },
    }),
  ]);

  return {
    totalAssets,
    totalValue: totalValueResult._sum.acquisitionValue ?? 0,
    inMaintenance,
    recentAcquisitions,
  };
}

export async function uploadAssetPhoto(ctx: RlsContext, assetId: string, filePaths: string[]) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: { photoUrls: true },
  });

  if (!asset) {
    throw new AssetError('Ativo não encontrado', 404);
  }

  const existing = Array.isArray(asset.photoUrls) ? (asset.photoUrls as string[]) : [];
  const updated = [...existing, ...filePaths];

  const result = await prisma.asset.update({
    where: { id: assetId },
    data: { photoUrls: updated },
    select: { photoUrls: true },
  });

  return result.photoUrls;
}

export async function getAssetsForMap(ctx: RlsContext, farmId?: string): Promise<AssetMapItem[]> {
  const farmFilter = farmId ? `AND a."farmId" = '${farmId}'` : '';
  const rows = await prisma.$queryRawUnsafe<AssetMapItem[]>(
    `SELECT
       a.id,
       a.name,
       a."assetTag" AS "assetTag",
       a."assetType" AS "assetType",
       a.status,
       a."farmId" AS "farmId",
       ST_Y(a."geoPoint") AS lat,
       ST_X(a."geoPoint") AS lon
     FROM assets a
     WHERE a."organizationId" = '${ctx.organizationId}'
       AND a."deletedAt" IS NULL
       AND a."geoPoint" IS NOT NULL
       ${farmFilter}
     ORDER BY a.name ASC`,
  );
  return rows;
}

export async function removeAssetPhoto(ctx: RlsContext, assetId: string, photoUrl: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: { photoUrls: true },
  });

  if (!asset) {
    throw new AssetError('Ativo não encontrado', 404);
  }

  const existing = Array.isArray(asset.photoUrls) ? (asset.photoUrls as string[]) : [];
  const updated = existing.filter((url) => url !== photoUrl);

  const result = await prisma.asset.update({
    where: { id: assetId },
    data: { photoUrls: updated },
    select: { photoUrls: true },
  });

  return result.photoUrls;
}
