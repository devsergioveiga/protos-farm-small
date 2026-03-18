import { withRlsContext, type RlsContext } from '../../database/rls';
import type { OwnerType, PropertyDocumentType, ExtractionStatus } from '@prisma/client';
import { extractFromDocument } from './document-parsers/extract';
import { parseGeoFile, validateGeometry } from '../farms/geo-parser';
import { logger } from '../../shared/utils/logger';
import {
  RuralPropertyError,
  VALID_UF,
  CIB_REGEX,
  LAND_CLASSIFICATIONS,
  OWNER_TYPES,
  DOCUMENT_TYPES,
  type CreateRuralPropertyInput,
  type UpdateRuralPropertyInput,
  type CreateOwnerInput,
  type UpdateOwnerInput,
  type UploadDocumentInput,
  type RuralPropertyItem,
  type RuralPropertyDetail,
  type OwnerItem,
  type PropertyDocumentItem,
} from './rural-properties.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateUf(uf: string): void {
  if (!(VALID_UF as readonly string[]).includes(uf)) {
    throw new RuralPropertyError(`UF inválida: ${uf}`, 400);
  }
}

function validateCib(cib: string | undefined): void {
  if (cib && !CIB_REGEX.test(cib)) {
    throw new RuralPropertyError('Formato de CIB inválido. Esperado: XXX.XXX.XXX-X', 400);
  }
}

function validateLandClassification(classification: string | undefined): void {
  if (classification && !(LAND_CLASSIFICATIONS as readonly string[]).includes(classification)) {
    throw new RuralPropertyError(
      `Classificação fundiária inválida. Valores permitidos: ${LAND_CLASSIFICATIONS.join(', ')}`,
      400,
    );
  }
}

function validateOwnerType(type: string | undefined): void {
  if (type && !(OWNER_TYPES as readonly string[]).includes(type)) {
    throw new RuralPropertyError(
      `Tipo de titular inválido. Valores permitidos: ${OWNER_TYPES.join(', ')}`,
      400,
    );
  }
}

function validateDocumentType(type: string): void {
  if (!(DOCUMENT_TYPES as readonly string[]).includes(type)) {
    throw new RuralPropertyError(
      `Tipo de documento inválido. Valores permitidos: ${DOCUMENT_TYPES.join(', ')}`,
      400,
    );
  }
}

function toNumber(val: unknown): number | null {
  if (val == null) return null;
  return Number(val);
}

function formatProperty(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rp: any,
  counts?: { titlesCount: number; ownersCount: number; documentsCount: number },
): RuralPropertyItem {
  return {
    id: rp.id,
    farmId: rp.farmId,
    denomination: rp.denomination,
    cib: rp.cib,
    incraCode: rp.incraCode,
    ccirCode: rp.ccirCode,
    ccirValidUntil: rp.ccirValidUntil
      ? new Date(rp.ccirValidUntil).toISOString().split('T')[0]
      : null,
    carCode: rp.carCode,
    totalAreaHa: toNumber(rp.totalAreaHa),
    landClassification: rp.landClassification,
    productive: rp.productive,
    municipality: rp.municipality,
    state: rp.state,
    boundaryAreaHa: toNumber(rp.boundaryAreaHa),
    titlesCount: counts?.titlesCount ?? rp._count?.titles ?? 0,
    ownersCount: counts?.ownersCount ?? rp._count?.owners ?? 0,
    documentsCount: counts?.documentsCount ?? rp._count?.documents ?? 0,
    createdAt: rp.createdAt instanceof Date ? rp.createdAt.toISOString() : rp.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDetail(rp: any): RuralPropertyDetail {
  const base = formatProperty(rp);
  return {
    ...base,
    ccirIssuedAt: rp.ccirIssuedAt ? new Date(rp.ccirIssuedAt).toISOString().split('T')[0] : null,
    ccirGeneratedAt: rp.ccirGeneratedAt
      ? new Date(rp.ccirGeneratedAt).toISOString().split('T')[0]
      : null,
    ccirPaymentStatus: rp.ccirPaymentStatus ?? null,
    registeredAreaHa: toNumber(rp.registeredAreaHa),
    possessionByTitleHa: toNumber(rp.possessionByTitleHa),
    possessionByOccupationHa: toNumber(rp.possessionByOccupationHa),
    measuredAreaHa: toNumber(rp.measuredAreaHa),
    certifiedAreaHa: toNumber(rp.certifiedAreaHa),
    locationDirections: rp.locationDirections ?? null,
    lastProcessingDate: rp.lastProcessingDate
      ? new Date(rp.lastProcessingDate).toISOString().split('T')[0]
      : null,
    fiscalModuleHa: toNumber(rp.fiscalModuleHa),
    fiscalModulesCount: toNumber(rp.fiscalModulesCount),
    ruralModuleHa: toNumber(rp.ruralModuleHa),
    ruralModulesCount: toNumber(rp.ruralModulesCount),
    minPartitionFraction: toNumber(rp.minPartitionFraction),
    vtnPerHa: toNumber(rp.vtnPerHa),
    appAreaHa: toNumber(rp.appAreaHa),
    legalReserveHa: toNumber(rp.legalReserveHa),
    taxableAreaHa: toNumber(rp.taxableAreaHa),
    usableAreaHa: toNumber(rp.usableAreaHa),
    utilizationDegree: toNumber(rp.utilizationDegree),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    owners: (rp.owners ?? []).map((o: any) => ({
      id: o.id,
      name: o.name,
      document: o.document,
      documentType: o.documentType,
      fractionPct: toNumber(o.fractionPct),
      ownerType: o.ownerType,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    titles: (rp.titles ?? []).map((t: any) => ({
      id: t.id,
      number: t.number,
      cartorioName: t.cartorioName,
      comarca: t.comarca,
      state: t.state,
      areaHa: Number(t.areaHa),
    })),
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function createRuralProperty(
  ctx: RlsContext,
  farmId: string,
  input: CreateRuralPropertyInput,
): Promise<RuralPropertyItem> {
  if (!input.denomination?.trim()) {
    throw new RuralPropertyError('Denominação é obrigatória', 400);
  }
  if (input.state) validateUf(input.state);
  validateCib(input.cib);
  validateLandClassification(input.landClassification);

  return withRlsContext(ctx, async (tx) => {
    // Verify farm exists and belongs to org
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) throw new RuralPropertyError('Fazenda não encontrada', 404);

    const rp = await tx.ruralProperty.create({
      data: {
        farmId,
        denomination: input.denomination.trim(),
        cib: input.cib || null,
        incraCode: input.incraCode || null,
        ccirCode: input.ccirCode || null,
        ccirValidUntil: input.ccirValidUntil ? new Date(input.ccirValidUntil) : null,
        ccirIssuedAt: input.ccirIssuedAt ? new Date(input.ccirIssuedAt) : null,
        ccirGeneratedAt: input.ccirGeneratedAt ? new Date(input.ccirGeneratedAt) : null,
        ccirPaymentStatus: input.ccirPaymentStatus || null,
        carCode: input.carCode || null,
        totalAreaHa: input.totalAreaHa ?? null,
        registeredAreaHa: input.registeredAreaHa ?? null,
        possessionByTitleHa: input.possessionByTitleHa ?? null,
        possessionByOccupationHa: input.possessionByOccupationHa ?? null,
        measuredAreaHa: input.measuredAreaHa ?? null,
        certifiedAreaHa: input.certifiedAreaHa ?? null,
        landClassification: input.landClassification || null,
        productive: input.productive ?? null,
        locationDirections: input.locationDirections || null,
        lastProcessingDate: input.lastProcessingDate ? new Date(input.lastProcessingDate) : null,
        fiscalModuleHa: input.fiscalModuleHa ?? null,
        fiscalModulesCount: input.fiscalModulesCount ?? null,
        ruralModuleHa: input.ruralModuleHa ?? null,
        ruralModulesCount: input.ruralModulesCount ?? null,
        minPartitionFraction: input.minPartitionFraction ?? null,
        vtnPerHa: input.vtnPerHa ?? null,
        appAreaHa: input.appAreaHa ?? null,
        legalReserveHa: input.legalReserveHa ?? null,
        taxableAreaHa: input.taxableAreaHa ?? null,
        usableAreaHa: input.usableAreaHa ?? null,
        utilizationDegree: input.utilizationDegree ?? null,
        municipality: input.municipality || null,
        state: input.state || null,
      },
      include: {
        _count: { select: { titles: true, owners: true, documents: true } },
      },
    });

    return formatProperty(rp);
  });
}

export async function listAllRuralProperties(
  ctx: RlsContext,
): Promise<(RuralPropertyItem & { farmName: string })[]> {
  return withRlsContext(ctx, async (tx) => {
    const properties = await tx.ruralProperty.findMany({
      where: {
        deletedAt: null,
        farm: {
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      },
      include: {
        farm: { select: { name: true } },
        _count: { select: { titles: true, owners: true, documents: true } },
      },
      orderBy: [{ farm: { name: 'asc' } }, { denomination: 'asc' }],
    });

    return properties.map((rp) => ({
      ...formatProperty(rp),
      farmName: rp.farm.name,
    }));
  });
}

export async function listRuralProperties(
  ctx: RlsContext,
  farmId: string,
): Promise<RuralPropertyItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) throw new RuralPropertyError('Fazenda não encontrada', 404);

    const properties = await tx.ruralProperty.findMany({
      where: { farmId, deletedAt: null },
      include: {
        _count: { select: { titles: true, owners: true, documents: true } },
      },
      orderBy: { denomination: 'asc' },
    });

    return properties.map((rp) => formatProperty(rp));
  });
}

export async function getRuralProperty(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
): Promise<RuralPropertyDetail> {
  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      include: {
        owners: { orderBy: { name: 'asc' } },
        titles: {
          select: {
            id: true,
            number: true,
            cartorioName: true,
            comarca: true,
            state: true,
            areaHa: true,
          },
          orderBy: { number: 'asc' },
        },
        _count: { select: { titles: true, owners: true, documents: true } },
      },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    return formatDetail(rp);
  });
}

export async function updateRuralProperty(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
  input: UpdateRuralPropertyInput,
): Promise<RuralPropertyDetail> {
  if (input.state) validateUf(input.state);
  validateCib(input.cib);
  validateLandClassification(input.landClassification);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const data: Record<string, unknown> = {};
    if (input.denomination !== undefined) data.denomination = input.denomination.trim();
    if (input.cib !== undefined) data.cib = input.cib || null;
    if (input.incraCode !== undefined) data.incraCode = input.incraCode || null;
    if (input.ccirCode !== undefined) data.ccirCode = input.ccirCode || null;
    if (input.ccirValidUntil !== undefined)
      data.ccirValidUntil = input.ccirValidUntil ? new Date(input.ccirValidUntil) : null;
    if (input.ccirIssuedAt !== undefined)
      data.ccirIssuedAt = input.ccirIssuedAt ? new Date(input.ccirIssuedAt) : null;
    if (input.ccirGeneratedAt !== undefined)
      data.ccirGeneratedAt = input.ccirGeneratedAt ? new Date(input.ccirGeneratedAt) : null;
    if (input.ccirPaymentStatus !== undefined)
      data.ccirPaymentStatus = input.ccirPaymentStatus || null;
    if (input.carCode !== undefined) data.carCode = input.carCode || null;
    if (input.totalAreaHa !== undefined) data.totalAreaHa = input.totalAreaHa;
    if (input.registeredAreaHa !== undefined) data.registeredAreaHa = input.registeredAreaHa;
    if (input.possessionByTitleHa !== undefined)
      data.possessionByTitleHa = input.possessionByTitleHa;
    if (input.possessionByOccupationHa !== undefined)
      data.possessionByOccupationHa = input.possessionByOccupationHa;
    if (input.measuredAreaHa !== undefined) data.measuredAreaHa = input.measuredAreaHa;
    if (input.certifiedAreaHa !== undefined) data.certifiedAreaHa = input.certifiedAreaHa;
    if (input.landClassification !== undefined)
      data.landClassification = input.landClassification || null;
    if (input.productive !== undefined) data.productive = input.productive;
    if (input.locationDirections !== undefined)
      data.locationDirections = input.locationDirections || null;
    if (input.lastProcessingDate !== undefined)
      data.lastProcessingDate = input.lastProcessingDate
        ? new Date(input.lastProcessingDate)
        : null;
    if (input.fiscalModuleHa !== undefined) data.fiscalModuleHa = input.fiscalModuleHa;
    if (input.fiscalModulesCount !== undefined) data.fiscalModulesCount = input.fiscalModulesCount;
    if (input.ruralModuleHa !== undefined) data.ruralModuleHa = input.ruralModuleHa;
    if (input.ruralModulesCount !== undefined) data.ruralModulesCount = input.ruralModulesCount;
    if (input.minPartitionFraction !== undefined)
      data.minPartitionFraction = input.minPartitionFraction;
    if (input.vtnPerHa !== undefined) data.vtnPerHa = input.vtnPerHa;
    if (input.appAreaHa !== undefined) data.appAreaHa = input.appAreaHa;
    if (input.legalReserveHa !== undefined) data.legalReserveHa = input.legalReserveHa;
    if (input.taxableAreaHa !== undefined) data.taxableAreaHa = input.taxableAreaHa;
    if (input.usableAreaHa !== undefined) data.usableAreaHa = input.usableAreaHa;
    if (input.utilizationDegree !== undefined) data.utilizationDegree = input.utilizationDegree;
    if (input.municipality !== undefined) data.municipality = input.municipality || null;
    if (input.state !== undefined) data.state = input.state || null;

    const rp = await tx.ruralProperty.update({
      where: { id: propertyId },
      data,
      include: {
        owners: { orderBy: { name: 'asc' } },
        titles: {
          select: {
            id: true,
            number: true,
            cartorioName: true,
            comarca: true,
            state: true,
            areaHa: true,
          },
          orderBy: { number: 'asc' },
        },
        _count: { select: { titles: true, owners: true, documents: true } },
      },
    });

    return formatDetail(rp);
  });
}

export async function deleteRuralProperty(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    await tx.ruralProperty.update({
      where: { id: propertyId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── Owners ─────────────────────────────────────────────────────────

export async function addOwner(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
  input: CreateOwnerInput,
): Promise<OwnerItem> {
  if (!input.name?.trim()) {
    throw new RuralPropertyError('Nome do titular é obrigatório', 400);
  }
  validateOwnerType(input.ownerType);

  if (input.fractionPct != null && (input.fractionPct < 0 || input.fractionPct > 100)) {
    throw new RuralPropertyError('Fração percentual deve estar entre 0 e 100', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const owner = await tx.propertyOwner.create({
      data: {
        ruralPropertyId: propertyId,
        name: input.name.trim(),
        document: input.document || null,
        documentType: input.documentType || null,
        fractionPct: input.fractionPct ?? null,
        ownerType: (input.ownerType as OwnerType) || 'PROPRIETARIO',
      },
    });

    return {
      id: owner.id,
      name: owner.name,
      document: owner.document,
      documentType: owner.documentType,
      fractionPct: toNumber(owner.fractionPct),
      ownerType: owner.ownerType,
    };
  });
}

export async function updateOwner(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
  ownerId: string,
  input: UpdateOwnerInput,
): Promise<OwnerItem> {
  validateOwnerType(input.ownerType);

  if (input.fractionPct != null && (input.fractionPct < 0 || input.fractionPct > 100)) {
    throw new RuralPropertyError('Fração percentual deve estar entre 0 e 100', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const existing = await tx.propertyOwner.findFirst({
      where: { id: ownerId, ruralPropertyId: propertyId },
    });
    if (!existing) throw new RuralPropertyError('Titular não encontrado', 404);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.document !== undefined) data.document = input.document || null;
    if (input.documentType !== undefined) data.documentType = input.documentType || null;
    if (input.fractionPct !== undefined) data.fractionPct = input.fractionPct;
    if (input.ownerType !== undefined) data.ownerType = input.ownerType;

    const owner = await tx.propertyOwner.update({
      where: { id: ownerId },
      data,
    });

    return {
      id: owner.id,
      name: owner.name,
      document: owner.document,
      documentType: owner.documentType,
      fractionPct: toNumber(owner.fractionPct),
      ownerType: owner.ownerType,
    };
  });
}

export async function deleteOwner(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
  ownerId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const existing = await tx.propertyOwner.findFirst({
      where: { id: ownerId, ruralPropertyId: propertyId },
    });
    if (!existing) throw new RuralPropertyError('Titular não encontrado', 404);

    await tx.propertyOwner.delete({ where: { id: ownerId } });
  });
}

// ─── Documents ──────────────────────────────────────────────────────

export async function uploadDocument(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
  input: UploadDocumentInput,
  actorId: string,
): Promise<PropertyDocumentItem> {
  validateDocumentType(input.type);

  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const doc = await tx.propertyDocument.create({
      data: {
        ruralPropertyId: propertyId,
        type: input.type as PropertyDocumentType,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        fileData: new Uint8Array(input.fileData),
        extractionStatus: 'PENDING',
        uploadedBy: actorId,
      },
    });

    // Attempt synchronous extraction for supported types
    const extractableTypes = ['CAFIR', 'CCIR', 'DITR', 'CAR_RECEIPT'];
    let extractionStatus = 'PENDING';
    let extractedData: unknown = null;

    if (extractableTypes.includes(input.type) && input.mimeType === 'application/pdf') {
      const result = await extractFromDocument(input.type, input.fileData, input.mimeType);
      extractionStatus = result.status;
      extractedData = result.data;

      await tx.propertyDocument.update({
        where: { id: doc.id },
        data: {
          extractionStatus: result.status as ExtractionStatus,
          extractedData: result.data as object,
        },
      });
    }

    return {
      id: doc.id,
      type: doc.type,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      extractionStatus,
      extractedData,
      uploadedAt: doc.uploadedAt.toISOString(),
      uploadedBy: doc.uploadedBy,
    };
  });
}

export async function listDocuments(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
): Promise<PropertyDocumentItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const docs = await tx.propertyDocument.findMany({
      where: { ruralPropertyId: propertyId },
      select: {
        id: true,
        type: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        extractionStatus: true,
        extractedData: true,
        uploadedAt: true,
        uploadedBy: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return docs.map((d) => ({
      id: d.id,
      type: d.type,
      filename: d.filename,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      extractionStatus: d.extractionStatus,
      extractedData: d.extractedData,
      uploadedAt: d.uploadedAt.toISOString(),
      uploadedBy: d.uploadedBy,
    }));
  });
}

export async function getDocument(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
  docId: string,
): Promise<{ filename: string; mimeType: string; fileData: Buffer }> {
  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const doc = await tx.propertyDocument.findFirst({
      where: { id: docId, ruralPropertyId: propertyId },
      select: { filename: true, mimeType: true, fileData: true },
    });
    if (!doc) throw new RuralPropertyError('Documento não encontrado', 404);
    if (!doc.fileData) throw new RuralPropertyError('Arquivo não disponível', 404);

    return {
      filename: doc.filename,
      mimeType: doc.mimeType || 'application/octet-stream',
      fileData: Buffer.from(doc.fileData),
    };
  });
}

export async function deleteDocument(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
  docId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const existing = await tx.propertyDocument.findFirst({
      where: { id: docId, ruralPropertyId: propertyId },
      select: { id: true },
    });
    if (!existing) throw new RuralPropertyError('Documento não encontrado', 404);

    await tx.propertyDocument.delete({ where: { id: docId } });
  });
}

// ─── Boundary Upload ──────────────────────────────────────────────

export interface BoundaryUploadResult {
  boundaryAreaHa: number;
  polygonCount: number;
  warnings: string[];
}

export async function uploadRuralPropertyBoundary(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
  buffer: Buffer,
  filename: string,
): Promise<BoundaryUploadResult> {
  const parsed = await parseGeoFile(buffer, filename);
  const warnings = [...parsed.warnings];

  if (parsed.boundaries.length === 0) {
    throw new RuralPropertyError('Nenhum polígono encontrado no arquivo', 400);
  }

  // Validate each polygon
  for (let i = 0; i < parsed.boundaries.length; i++) {
    const validation = validateGeometry(parsed.boundaries[i]);
    if (!validation.valid) {
      throw new RuralPropertyError(
        `Polígono ${i + 1} inválido: ${validation.errors.join('; ')}`,
        400,
      );
    }
  }

  // Build MultiPolygon GeoJSON
  const multiPolygon: GeoJSON.MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: parsed.boundaries.map((p) => p.coordinates),
  };
  const geojsonStr = JSON.stringify(multiPolygon);

  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const result = await tx.$queryRawUnsafe<{ area_ha: number; is_valid: boolean }[]>(
      `UPDATE rural_properties
       SET boundary = ST_GeomFromGeoJSON($1),
           "boundaryAreaHa" = ROUND((ST_Area(ST_GeomFromGeoJSON($1)::geography) / 10000)::numeric, 4),
           "updatedAt" = now()
       WHERE id = $2
       RETURNING
         ROUND((ST_Area(boundary::geography) / 10000)::numeric, 4)::float AS area_ha,
         ST_IsValid(boundary) AS is_valid`,
      geojsonStr,
      propertyId,
    );

    if (!result[0]) {
      throw new RuralPropertyError('Erro ao salvar perímetro', 500);
    }

    if (!result[0].is_valid) {
      warnings.push('PostGIS marcou a geometria como inválida (ST_IsValid=false)');
    }

    const boundaryAreaHa = result[0].area_ha;

    // Recalculate farm totalAreaHa as sum of all rural property boundary areas
    const sumResult = await tx.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COALESCE(SUM("boundaryAreaHa"), 0)::float AS total
       FROM rural_properties
       WHERE "farmId" = $1 AND "deletedAt" IS NULL AND "boundaryAreaHa" IS NOT NULL`,
      farmId,
    );
    const newFarmTotal = sumResult[0]?.total ?? 0;
    if (newFarmTotal > 0) {
      await tx.farm.update({
        where: { id: farmId },
        data: { totalAreaHa: newFarmTotal },
      });
      logger.info(
        { farmId, newFarmTotal },
        'Farm totalAreaHa recalculated from rural property boundaries',
      );
    }

    logger.info(
      { farmId, propertyId, boundaryAreaHa, polygonCount: parsed.boundaries.length },
      'Rural property boundary uploaded',
    );

    return { boundaryAreaHa, polygonCount: parsed.boundaries.length, warnings };
  });
}

// ─── Get Boundary ─────────────────────────────────────────────────

export interface RuralPropertyBoundaryInfo {
  hasBoundary: boolean;
  boundaryAreaHa: number | null;
  boundaryGeoJSON: GeoJSON.MultiPolygon | null;
  polygonCount: number;
}

export async function getRuralPropertyBoundary(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
): Promise<RuralPropertyBoundaryInfo> {
  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    const rows = await tx.$queryRawUnsafe<{ geojson: string | null; area_ha: number | null }[]>(
      `SELECT ST_AsGeoJSON(boundary)::text AS geojson, "boundaryAreaHa"::float AS area_ha
       FROM rural_properties WHERE id = $1`,
      propertyId,
    );

    const row = rows[0];
    if (!row?.geojson) {
      return { hasBoundary: false, boundaryAreaHa: null, boundaryGeoJSON: null, polygonCount: 0 };
    }

    const geojson = JSON.parse(row.geojson) as GeoJSON.MultiPolygon;
    return {
      hasBoundary: true,
      boundaryAreaHa: row.area_ha,
      boundaryGeoJSON: geojson,
      polygonCount: geojson.coordinates.length,
    };
  });
}

// ─── Delete Boundary ──────────────────────────────────────────────

export async function deleteRuralPropertyBoundary(
  ctx: RlsContext,
  farmId: string,
  propertyId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const rp = await tx.ruralProperty.findFirst({
      where: { id: propertyId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!rp) throw new RuralPropertyError('Imóvel rural não encontrado', 404);

    await tx.$executeRawUnsafe(
      `UPDATE rural_properties SET boundary = NULL, "boundaryAreaHa" = NULL, "updatedAt" = now() WHERE id = $1`,
      propertyId,
    );

    // Recalculate farm totalAreaHa from remaining property boundaries
    const sumResult = await tx.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COALESCE(SUM("boundaryAreaHa"), 0)::float AS total
       FROM rural_properties
       WHERE "farmId" = $1 AND "deletedAt" IS NULL AND "boundaryAreaHa" IS NOT NULL`,
      farmId,
    );
    const newFarmTotal = sumResult[0]?.total ?? 0;
    await tx.farm.update({
      where: { id: farmId },
      data: { totalAreaHa: newFarmTotal },
    });
    logger.info({ farmId, newFarmTotal }, 'Farm totalAreaHa recalculated after boundary delete');

    logger.info({ farmId, propertyId }, 'Rural property boundary deleted');
  });
}
