import crypto from 'node:crypto';
import { OrgStatus } from '@prisma/client';
import { withRlsBypass } from '../../database/rls';
import { redis } from '../../database/redis';
import { loadEnv } from '../../config/env';
import { sendMail } from '../../shared/mail/mail.service';
import { logger } from '../../shared/utils/logger';
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

  return withRlsBypass(async (tx) => {
    const existing = await tx.organization.findUnique({ where: { document: cleaned } });
    if (existing) {
      throw new OrgError('Documento já cadastrado', 409);
    }

    if (input.plan && !VALID_PLANS.includes(input.plan)) {
      throw new OrgError('Plano inválido', 400);
    }

    const org = await tx.organization.create({
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
  });
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

  return withRlsBypass(async (tx) => {
    const [data, total] = await Promise.all([
      tx.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, farms: true } } },
      }),
      tx.organization.count({ where }),
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

export async function getOrganizationById(id: string) {
  return withRlsBypass(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true, farms: true } } },
    });

    if (!org) {
      throw new OrgError('Organização não encontrada', 404);
    }

    return org;
  });
}

export async function updateOrganizationStatus(id: string, status: OrgStatus) {
  return withRlsBypass(async (tx) => {
    const org = await tx.organization.findUnique({ where: { id } });
    if (!org) {
      throw new OrgError('Organização não encontrada', 404);
    }

    const allowed = ALLOWED_TRANSITIONS[org.status];
    if (!allowed || !allowed.includes(status)) {
      throw new OrgError(`Transição de status ${org.status} → ${status} não permitida`, 422);
    }

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
}

export async function updateOrganizationPlan(
  id: string,
  input: { plan: string; maxUsers?: number; maxFarms?: number },
) {
  if (!VALID_PLANS.includes(input.plan)) {
    throw new OrgError('Plano inválido', 400);
  }

  return withRlsBypass(async (tx) => {
    const org = await tx.organization.findUnique({
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

    const updated = await tx.organization.update({
      where: { id },
      data: {
        plan: input.plan,
        ...(input.maxUsers !== undefined && { maxUsers: input.maxUsers }),
        ...(input.maxFarms !== undefined && { maxFarms: input.maxFarms }),
      },
    });

    return updated;
  });
}

// ─── Session policy ────────────────────────────────────────────────

export async function updateSessionPolicy(id: string, allowMultipleSessions: boolean) {
  return withRlsBypass(async (tx) => {
    const org = await tx.organization.findUnique({ where: { id } });
    if (!org) {
      throw new OrgError('Organização não encontrada', 404);
    }

    const updated = await tx.organization.update({
      where: { id },
      data: { allowMultipleSessions },
    });

    return updated;
  });
}

// ─── Social login policy ──────────────────────────────────────────

export async function updateSocialLoginPolicy(id: string, allowSocialLogin: boolean) {
  return withRlsBypass(async (tx) => {
    const org = await tx.organization.findUnique({ where: { id } });
    if (!org) {
      throw new OrgError('Organização não encontrada', 404);
    }

    const updated = await tx.organization.update({
      where: { id },
      data: { allowSocialLogin },
    });

    return updated;
  });
}

// ─── Org admin management ──────────────────────────────────────────

const INVITE_PREFIX = 'invite_token:';
const PASSWORD_RESET_PREFIX = 'password_reset:';

export interface CreateOrgAdminInput {
  name: string;
  email: string;
  phone?: string;
}

export async function createOrgAdmin(orgId: string, input: CreateOrgAdminInput) {
  return withRlsBypass(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      include: { _count: { select: { users: true } } },
    });

    if (!org) {
      throw new OrgError('Organização não encontrada', 404);
    }

    if (org.status !== 'ACTIVE') {
      throw new OrgError('Organização não está ativa', 422);
    }

    if (org._count.users >= org.maxUsers) {
      throw new OrgError('Limite de usuários atingido', 422);
    }

    const existingUser = await tx.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      throw new OrgError('Email já cadastrado', 409);
    }

    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        role: 'ADMIN',
        passwordHash: null,
        status: 'ACTIVE',
        organizationId: orgId,
      },
    });

    const env = loadEnv();
    const token = crypto.randomUUID();
    await redis.set(`${INVITE_PREFIX}${token}`, user.id, 'EX', env.INVITE_TOKEN_EXPIRES_IN);

    const inviteUrl = `${env.FRONTEND_URL}/accept-invite?token=${token}`;

    await sendMail({
      to: user.email,
      subject: 'Protos Farm — Convite para definir sua senha',
      text: `Olá ${user.name},\n\nVocê foi convidado(a) como administrador(a) da organização ${org.name} no Protos Farm.\n\nClique no link abaixo para definir sua senha:\n${inviteUrl}\n\nEste link expira em 48 horas.\n\nEquipe Protos Farm`,
      html: `<p>Olá <strong>${user.name}</strong>,</p><p>Você foi convidado(a) como administrador(a) da organização <strong>${org.name}</strong> no Protos Farm.</p><p><a href="${inviteUrl}">Clique aqui para definir sua senha</a></p><p>Este link expira em 48 horas.</p><p>Equipe Protos Farm</p>`,
    });

    logger.info({ userId: user.id, orgId, email: user.email }, 'Org admin invite sent');

    return user;
  });
}

export async function resetOrgUserPassword(orgId: string, userId: string) {
  return withRlsBypass(async (tx) => {
    const org = await tx.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new OrgError('Organização não encontrada', 404);
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.organizationId !== orgId) {
      throw new OrgError('Usuário não encontrado nesta organização', 404);
    }

    const env = loadEnv();
    const token = crypto.randomUUID();
    await redis.set(
      `${PASSWORD_RESET_PREFIX}${token}`,
      userId,
      'EX',
      env.PASSWORD_RESET_EXPIRES_IN,
    );

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

    await sendMail({
      to: user.email,
      subject: 'Protos Farm — Redefinição de senha',
      text: `Olá ${user.name},\n\nUma redefinição de senha foi solicitada para sua conta.\n\nClique no link abaixo para criar uma nova senha:\n${resetUrl}\n\nEste link expira em 1 hora.\n\nSe você não solicitou esta alteração, entre em contato com o suporte.\n\nEquipe Protos Farm`,
      html: `<p>Olá <strong>${user.name}</strong>,</p><p>Uma redefinição de senha foi solicitada para sua conta.</p><p><a href="${resetUrl}">Clique aqui para criar uma nova senha</a></p><p>Este link expira em 1 hora.</p><p>Se você não solicitou esta alteração, entre em contato com o suporte.</p><p>Equipe Protos Farm</p>`,
    });

    logger.info({ userId, orgId }, 'Org user password reset email sent');

    return { message: 'Email de redefinição de senha enviado' };
  });
}

export async function unlockOrgUser(orgId: string, userId: string) {
  return withRlsBypass(async (tx) => {
    const org = await tx.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new OrgError('Organização não encontrada', 404);
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.organizationId !== orgId) {
      throw new OrgError('Usuário não encontrado nesta organização', 404);
    }

    if (user.status === 'ACTIVE') {
      throw new OrgError('Usuário já está ativo', 422);
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    logger.info({ userId, orgId }, 'Org user unlocked');

    return updated;
  });
}
