import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import { AssetError } from './assets.types';

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreateAssetDocumentInput {
  assetId: string;
  documentType: string;
  documentName: string;
  description?: string;
  expiresAt?: string | Date;
  fileUrl?: string;
}

export interface UpdateAssetDocumentInput {
  documentType?: string;
  documentName?: string;
  description?: string;
  expiresAt?: string | Date | null;
  fileUrl?: string;
}

export interface ListAssetDocumentsQuery {
  assetId?: string;
  expiringWithinDays?: number;
  page?: number;
  limit?: number;
}

// ─── Service functions ────────────────────────────────────────────────

export async function createAssetDocument(
  ctx: RlsContext & { userId: string },
  input: CreateAssetDocumentInput,
) {
  if (!input.assetId) throw new AssetError('Ativo é obrigatório', 400);
  if (!input.documentType) throw new AssetError('Tipo de documento é obrigatório', 400);
  if (!input.documentName) throw new AssetError('Nome do documento é obrigatório', 400);

  // Verify asset belongs to org
  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!asset) throw new AssetError('Ativo não encontrado', 404);

  return prisma.assetDocument.create({
    data: {
      organizationId: ctx.organizationId,
      assetId: input.assetId,
      documentType: input.documentType as never,
      documentName: input.documentName,
      description: input.description,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      fileUrl: input.fileUrl,
      createdBy: ctx.userId,
    },
    include: { asset: { select: { name: true, assetTag: true } } },
  });
}

export async function listAssetDocuments(ctx: RlsContext, query: ListAssetDocumentsQuery) {
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 20), 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: ctx.organizationId };

  if (query.assetId) where['assetId'] = query.assetId;

  if (query.expiringWithinDays != null) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + Number(query.expiringWithinDays) * 24 * 60 * 60 * 1000);
    where['expiresAt'] = { not: null, lte: cutoff };
  }

  const [data, total] = await Promise.all([
    prisma.assetDocument.findMany({
      where: where as never,
      include: { asset: { select: { name: true, assetTag: true } } },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.assetDocument.count({ where: where as never }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getExpiringDocuments(ctx: RlsContext) {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const docs = await prisma.assetDocument.findMany({
    where: {
      organizationId: ctx.organizationId,
      expiresAt: { not: null, lte: in30 },
    } as never,
    include: {
      asset: { select: { name: true, assetTag: true } },
    },
    orderBy: { expiresAt: 'asc' },
  });

  const expired: typeof docs = [];
  const urgent: typeof docs = [];
  const warning: typeof docs = [];
  const upcoming: typeof docs = [];

  for (const doc of docs) {
    if (!doc.expiresAt) continue;
    const diff = Math.floor((doc.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      expired.push(doc);
    } else if (doc.expiresAt <= in7) {
      urgent.push(doc);
    } else if (doc.expiresAt <= in15) {
      warning.push(doc);
    } else {
      upcoming.push(doc);
    }
  }

  function mapDoc(doc: (typeof docs)[number], daysUntilExpiry: number) {
    return {
      documentId: doc.id,
      assetId: doc.assetId,
      assetName: doc.asset.name,
      assetTag: doc.asset.assetTag,
      documentType: doc.documentType,
      documentName: doc.documentName,
      expiresAt: doc.expiresAt,
      daysUntilExpiry,
    };
  }

  return {
    expired: {
      count: expired.length,
      items: expired.map((d) =>
        mapDoc(d, Math.floor((d.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      ),
    },
    urgent: {
      count: urgent.length,
      items: urgent.map((d) =>
        mapDoc(d, Math.floor((d.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      ),
    },
    warning: {
      count: warning.length,
      items: warning.map((d) =>
        mapDoc(d, Math.floor((d.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      ),
    },
    upcoming: {
      count: upcoming.length,
      items: upcoming.map((d) =>
        mapDoc(d, Math.floor((d.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      ),
    },
  };
}

export async function updateAssetDocument(
  ctx: RlsContext,
  id: string,
  input: UpdateAssetDocumentInput,
) {
  const existing = await prisma.assetDocument.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existing) throw new AssetError('Documento não encontrado', 404);

  return prisma.assetDocument.update({
    where: { id },
    data: {
      ...(input.documentType !== undefined && { documentType: input.documentType as never }),
      ...(input.documentName !== undefined && { documentName: input.documentName }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.expiresAt !== undefined && {
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      }),
      ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl }),
    },
    include: { asset: { select: { name: true, assetTag: true } } },
  });
}

export async function deleteAssetDocument(ctx: RlsContext, id: string) {
  const existing = await prisma.assetDocument.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existing) throw new AssetError('Documento não encontrado', 404);

  return prisma.assetDocument.delete({ where: { id } });
}
