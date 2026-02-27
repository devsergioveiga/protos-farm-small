import { OrgStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { cleanDocument, validateDocument } from '../../shared/utils/document-validator';

// ─── Types ──────────────────────────────────────────────────────────

export class OrgError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'OrgError';
  }
}

export interface CreateOrgInput {
  name: string;
  type: 'PF' | 'PJ';
  document: string;
  plan?: string;
  maxUsers?: number;
  maxFarms?: number;
}

export interface ListOrgsQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

// ─── Valid plans ─────────────────────────────────────────────────────

const VALID_PLANS = ['basic', 'professional', 'enterprise'];

// ─── Status transitions ─────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, OrgStatus[]> = {
  ACTIVE: ['SUSPENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
};

// ─── Service functions ──────────────────────────────────────────────

export async function createOrganization(input: CreateOrgInput) {
  const cleaned = cleanDocument(input.document);

  if (!validateDocument(cleaned, input.type)) {
    throw new OrgError('Documento inválido', 400);
  }

  const existing = await prisma.organization.findUnique({ where: { document: cleaned } });
  if (existing) {
    throw new OrgError('Documento já cadastrado', 409);
  }

  if (input.plan && !VALID_PLANS.includes(input.plan)) {
    throw new OrgError('Plano inválido', 400);
  }

  const org = await prisma.organization.create({
    data: {
      name: input.name,
      type: input.type,
      document: cleaned,
      plan: input.plan ?? 'basic',
      maxUsers: input.maxUsers ?? 10,
      maxFarms: input.maxFarms ?? 5,
    },
  });

  return org;
}

export async function listOrganizations(query: ListOrgsQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { document: { contains: query.search } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, farms: true } } },
    }),
    prisma.organization.count({ where }),
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
}

export async function getOrganizationById(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { _count: { select: { users: true, farms: true } } },
  });

  if (!org) {
    throw new OrgError('Organização não encontrada', 404);
  }

  return org;
}

export async function updateOrganizationStatus(id: string, status: OrgStatus) {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    throw new OrgError('Organização não encontrada', 404);
  }

  const allowed = ALLOWED_TRANSITIONS[org.status];
  if (!allowed || !allowed.includes(status)) {
    throw new OrgError(`Transição de status ${org.status} → ${status} não permitida`, 422);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.organization.update({
      where: { id },
      data: { status },
    });

    if (status === 'SUSPENDED' || status === 'CANCELLED') {
      await tx.user.updateMany({
        where: { organizationId: id },
        data: { status: 'INACTIVE' },
      });
    } else if (status === 'ACTIVE') {
      await tx.user.updateMany({
        where: { organizationId: id },
        data: { status: 'ACTIVE' },
      });
    }

    return updated;
  });

  return result;
}

export async function updateOrganizationPlan(
  id: string,
  input: { plan: string; maxUsers?: number; maxFarms?: number },
) {
  if (!VALID_PLANS.includes(input.plan)) {
    throw new OrgError('Plano inválido', 400);
  }

  const org = await prisma.organization.findUnique({
    where: { id },
    include: { _count: { select: { users: true, farms: true } } },
  });

  if (!org) {
    throw new OrgError('Organização não encontrada', 404);
  }

  if (input.maxUsers !== undefined && input.maxUsers < org._count.users) {
    throw new OrgError(
      `Limite de usuários (${input.maxUsers}) menor que a quantidade atual (${org._count.users})`,
      422,
    );
  }

  if (input.maxFarms !== undefined && input.maxFarms < org._count.farms) {
    throw new OrgError(
      `Limite de fazendas (${input.maxFarms}) menor que a quantidade atual (${org._count.farms})`,
      422,
    );
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      plan: input.plan,
      ...(input.maxUsers !== undefined && { maxUsers: input.maxUsers }),
      ...(input.maxFarms !== undefined && { maxFarms: input.maxFarms }),
    },
  });

  return updated;
}
