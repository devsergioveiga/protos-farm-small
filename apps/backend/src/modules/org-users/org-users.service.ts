import crypto from 'node:crypto';
import { prisma } from '../../database/prisma';
import { redis } from '../../database/redis';
import { loadEnv } from '../../config/env';
import { sendMail } from '../../shared/mail/mail.service';
import { logger } from '../../shared/utils/logger';
import { invalidateAllUserSessions } from '../auth/auth.service';
import {
  ASSIGNABLE_ROLES,
  OrgUserError,
  ORG_INVITE_PREFIX,
  type CreateOrgUserInput,
  type UpdateOrgUserInput,
  type ListOrgUsersQuery,
} from './org-users.types';

// ─── Constants ──────────────────────────────────────────────────────

const PASSWORD_RESET_PREFIX = 'password_reset:';

// ─── CA1: Create org user ───────────────────────────────────────────

export async function createOrgUser(orgId: string, input: CreateOrgUserInput) {
  if (!ASSIGNABLE_ROLES.includes(input.role)) {
    throw new OrgUserError(`Role inválida. Roles permitidas: ${ASSIGNABLE_ROLES.join(', ')}`, 400);
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { _count: { select: { users: true } } },
  });

  if (!org) {
    throw new OrgUserError('Organização não encontrada', 404);
  }

  if (org.status !== 'ACTIVE') {
    throw new OrgUserError('Organização não está ativa', 422);
  }

  if (org._count.users >= org.maxUsers) {
    throw new OrgUserError('Limite de usuários atingido', 422);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw new OrgUserError('Email já cadastrado', 409);
  }

  if (input.farmIds && input.farmIds.length > 0) {
    const farms = await prisma.farm.findMany({
      where: { id: { in: input.farmIds }, organizationId: orgId },
    });
    if (farms.length !== input.farmIds.length) {
      throw new OrgUserError('Uma ou mais fazendas não pertencem a esta organização', 400);
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        role: input.role,
        passwordHash: null,
        status: 'ACTIVE',
        organizationId: orgId,
      },
    });

    if (input.farmIds && input.farmIds.length > 0) {
      await tx.userFarmAccess.createMany({
        data: input.farmIds.map((farmId) => ({
          userId: created.id,
          farmId,
        })),
      });
    }

    return created;
  });

  const env = loadEnv();
  const token = crypto.randomUUID();
  await redis.set(`${ORG_INVITE_PREFIX}${token}`, user.id, 'EX', env.ORG_INVITE_TOKEN_EXPIRES_IN);

  const inviteUrl = `${env.FRONTEND_URL}/accept-invite?token=${token}`;

  await sendMail({
    to: user.email,
    subject: 'Protos Farm — Convite para definir sua senha',
    text: `Olá ${user.name},\n\nVocê foi convidado(a) para a organização ${org.name} no Protos Farm como ${input.role}.\n\nClique no link abaixo para definir sua senha:\n${inviteUrl}\n\nEste link expira em 7 dias.\n\nEquipe Protos Farm`,
    html: `<p>Olá <strong>${user.name}</strong>,</p><p>Você foi convidado(a) para a organização <strong>${org.name}</strong> no Protos Farm como <strong>${input.role}</strong>.</p><p><a href="${inviteUrl}">Clique aqui para definir sua senha</a></p><p>Este link expira em 7 dias.</p><p>Equipe Protos Farm</p>`,
  });

  logger.info({ userId: user.id, orgId, email: user.email }, 'Org user invite sent');

  return user;
}

// ─── CA2: List org users ────────────────────────────────────────────

export async function listOrgUsers(orgId: string, query: ListOrgUsersQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: orgId };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.role) {
    where.role = query.role;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.farmId) {
    where.farmAccess = { some: { farmId: query.farmId } };
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        passwordHash: false,
        createdAt: true,
        farmAccess: {
          include: { farm: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.user.count({ where }),
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

export async function getOrgUser(orgId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      lastLoginAt: true,
      passwordHash: false,
      createdAt: true,
      updatedAt: true,
      farmAccess: {
        include: { farm: { select: { id: true, name: true } } },
      },
    },
  });

  if (!user || (await getUserOrgId(userId)) !== orgId) {
    throw new OrgUserError('Usuário não encontrado nesta organização', 404);
  }

  return user;
}

// ─── CA3: Update org user ───────────────────────────────────────────

export async function updateOrgUser(
  orgId: string,
  userId: string,
  actorId: string,
  input: UpdateOrgUserInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.organizationId !== orgId) {
    throw new OrgUserError('Usuário não encontrado nesta organização', 404);
  }

  if (input.role && actorId === userId) {
    throw new OrgUserError('Você não pode alterar sua própria role', 422);
  }

  if (input.role && !ASSIGNABLE_ROLES.includes(input.role)) {
    throw new OrgUserError(`Role inválida. Roles permitidas: ${ASSIGNABLE_ROLES.join(', ')}`, 400);
  }

  if (input.farmIds !== undefined && input.farmIds.length > 0) {
    const farms = await prisma.farm.findMany({
      where: { id: { in: input.farmIds }, organizationId: orgId },
    });
    if (farms.length !== input.farmIds.length) {
      throw new OrgUserError('Uma ou mais fazendas não pertencem a esta organização', 400);
    }
  }

  const roleChanged = input.role && input.role !== user.role;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone || null }),
        ...(input.role && { role: input.role }),
      },
    });

    if (input.farmIds !== undefined) {
      await tx.userFarmAccess.deleteMany({ where: { userId } });
      if (input.farmIds.length > 0) {
        await tx.userFarmAccess.createMany({
          data: input.farmIds.map((farmId) => ({ userId, farmId })),
        });
      }
    }

    return result;
  });

  if (roleChanged) {
    await invalidateAllUserSessions(userId);
  }

  logger.info({ userId, orgId, changes: input }, 'Org user updated');

  return updated;
}

// ─── CA4: Toggle status ─────────────────────────────────────────────

export async function toggleOrgUserStatus(
  orgId: string,
  userId: string,
  actorId: string,
  status: 'ACTIVE' | 'INACTIVE',
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.organizationId !== orgId) {
    throw new OrgUserError('Usuário não encontrado nesta organização', 404);
  }

  if (actorId === userId && status === 'INACTIVE') {
    throw new OrgUserError('Você não pode desativar sua própria conta', 422);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  if (status === 'INACTIVE') {
    await invalidateAllUserSessions(userId);
  }

  logger.info({ userId, orgId, status }, 'Org user status updated');

  return updated;
}

// ─── CA4: Reset password by admin ───────────────────────────────────

export async function resetOrgUserPasswordByAdmin(orgId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.organizationId !== orgId) {
    throw new OrgUserError('Usuário não encontrado nesta organização', 404);
  }

  const env = loadEnv();
  const token = crypto.randomUUID();
  await redis.set(`${PASSWORD_RESET_PREFIX}${token}`, userId, 'EX', env.PASSWORD_RESET_EXPIRES_IN);

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendMail({
    to: user.email,
    subject: 'Protos Farm — Redefinição de senha',
    text: `Olá ${user.name},\n\nUma redefinição de senha foi solicitada para sua conta.\n\nClique no link abaixo para criar uma nova senha:\n${resetUrl}\n\nEste link expira em 1 hora.\n\nSe você não solicitou esta alteração, entre em contato com o suporte.\n\nEquipe Protos Farm`,
    html: `<p>Olá <strong>${user.name}</strong>,</p><p>Uma redefinição de senha foi solicitada para sua conta.</p><p><a href="${resetUrl}">Clique aqui para criar uma nova senha</a></p><p>Este link expira em 1 hora.</p><p>Se você não solicitou esta alteração, entre em contato com o suporte.</p><p>Equipe Protos Farm</p>`,
  });

  logger.info({ userId, orgId }, 'Org user password reset email sent');

  return { message: 'Email de redefinição de senha enviado' };
}

// ─── CA5: User limit ────────────────────────────────────────────────

export async function getOrgUserLimit(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { _count: { select: { users: true } } },
  });

  if (!org) {
    throw new OrgUserError('Organização não encontrada', 404);
  }

  const current = org._count.users;
  const max = org.maxUsers;
  const percentage = Math.round((current / max) * 100);

  return {
    current,
    max,
    percentage,
    warning: percentage >= 80,
    blocked: percentage >= 100,
  };
}

// ─── CA5: Resend invite ─────────────────────────────────────────────

export async function resendInvite(orgId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.organizationId !== orgId) {
    throw new OrgUserError('Usuário não encontrado nesta organização', 404);
  }

  if (user.passwordHash !== null) {
    throw new OrgUserError('Usuário já definiu sua senha', 422);
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });

  const env = loadEnv();
  const token = crypto.randomUUID();
  await redis.set(`${ORG_INVITE_PREFIX}${token}`, userId, 'EX', env.ORG_INVITE_TOKEN_EXPIRES_IN);

  const inviteUrl = `${env.FRONTEND_URL}/accept-invite?token=${token}`;

  await sendMail({
    to: user.email,
    subject: 'Protos Farm — Convite reenviado',
    text: `Olá ${user.name},\n\nSeu convite para a organização ${org?.name ?? ''} no Protos Farm foi reenviado.\n\nClique no link abaixo para definir sua senha:\n${inviteUrl}\n\nEste link expira em 7 dias.\n\nEquipe Protos Farm`,
    html: `<p>Olá <strong>${user.name}</strong>,</p><p>Seu convite para a organização <strong>${org?.name ?? ''}</strong> no Protos Farm foi reenviado.</p><p><a href="${inviteUrl}">Clique aqui para definir sua senha</a></p><p>Este link expira em 7 dias.</p><p>Equipe Protos Farm</p>`,
  });

  logger.info({ userId, orgId }, 'Org user invite resent');

  return { message: 'Convite reenviado com sucesso', inviteUrl };
}

// ─── CA5: Generate invite link (no email) ───────────────────────────

export async function generateInviteLink(orgId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.organizationId !== orgId) {
    throw new OrgUserError('Usuário não encontrado nesta organização', 404);
  }

  if (user.passwordHash !== null) {
    throw new OrgUserError('Usuário já definiu sua senha', 422);
  }

  const env = loadEnv();
  const token = crypto.randomUUID();
  await redis.set(`${ORG_INVITE_PREFIX}${token}`, userId, 'EX', env.ORG_INVITE_TOKEN_EXPIRES_IN);

  const inviteUrl = `${env.FRONTEND_URL}/accept-invite?token=${token}`;

  logger.info({ userId, orgId }, 'Org user invite link generated');

  return { inviteUrl };
}

// ─── Helper ─────────────────────────────────────────────────────────

async function getUserOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}
