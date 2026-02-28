import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { redis } from '../../database/redis';
import { loadEnv } from '../../config/env';
import { sendMail } from '../../shared/mail/mail.service';
import { logger } from '../../shared/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── Password helpers ───────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Token helpers ──────────────────────────────────────────────────

export function generateAccessToken(payload: TokenPayload): string {
  const env = loadEnv();
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string & jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const env = loadEnv();
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

const REFRESH_PREFIX = 'refresh_token:';
const PASSWORD_RESET_PREFIX = 'password_reset:';
const INVITE_PREFIX = 'invite_token:';

async function saveRefreshToken(token: string, userId: string): Promise<void> {
  const env = loadEnv();
  await redis.set(`${REFRESH_PREFIX}${token}`, userId, 'EX', env.REFRESH_TOKEN_EXPIRES_IN);
}

async function consumeRefreshToken(token: string): Promise<string | null> {
  const key = `${REFRESH_PREFIX}${token}`;
  const userId = await redis.get(key);
  if (userId) {
    await redis.del(key);
  }
  return userId;
}

// ─── Core flows ─────────────────────────────────────────────────────

export async function login(input: LoginInput): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !user.passwordHash) {
    throw new AuthError('Credenciais inválidas', 401);
  }

  if (user.status !== 'ACTIVE') {
    throw new AuthError('Conta inativa', 403);
  }

  if (user.role !== 'SUPER_ADMIN') {
    const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
    if (!org || org.status !== 'ACTIVE') {
      throw new AuthError('Organização suspensa ou cancelada', 403);
    }
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);
  if (!passwordValid) {
    throw new AuthError('Credenciais inválidas', 401);
  }

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = crypto.randomUUID();

  await saveRefreshToken(refreshToken, user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return { accessToken, refreshToken };
}

export async function refreshTokens(token: string): Promise<AuthTokens> {
  const userId = await consumeRefreshToken(token);
  if (!userId) {
    throw new AuthError('Refresh token inválido ou expirado', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AuthError('Usuário não encontrado', 401);
  }

  if (user.status !== 'ACTIVE') {
    throw new AuthError('Conta inativa', 403);
  }

  if (user.role !== 'SUPER_ADMIN') {
    const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
    if (!org || org.status !== 'ACTIVE') {
      throw new AuthError('Organização suspensa ou cancelada', 403);
    }
  }

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  const accessToken = generateAccessToken(payload);
  const newRefreshToken = crypto.randomUUID();
  await saveRefreshToken(newRefreshToken, user.id);

  return { accessToken, refreshToken: newRefreshToken };
}

// ─── Password reset ────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.status !== 'ACTIVE') {
    logger.info({ email }, 'Password reset requested for unknown or inactive email');
    return;
  }

  const env = loadEnv();
  const token = crypto.randomUUID();

  await redis.set(`${PASSWORD_RESET_PREFIX}${token}`, user.id, 'EX', env.PASSWORD_RESET_EXPIRES_IN);

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendMail({
    to: user.email,
    subject: 'Protos Farm — Redefinição de senha',
    text: `Olá ${user.name},\n\nVocê solicitou a redefinição de sua senha.\n\nClique no link abaixo para criar uma nova senha:\n${resetUrl}\n\nEste link expira em 1 hora.\n\nSe você não solicitou esta alteração, ignore este email.\n\nEquipe Protos Farm`,
    html: `<p>Olá <strong>${user.name}</strong>,</p><p>Você solicitou a redefinição de sua senha.</p><p><a href="${resetUrl}">Clique aqui para criar uma nova senha</a></p><p>Este link expira em 1 hora.</p><p>Se você não solicitou esta alteração, ignore este email.</p><p>Equipe Protos Farm</p>`,
  });

  logger.info({ userId: user.id, email }, 'Password reset email sent');
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const key = `${PASSWORD_RESET_PREFIX}${token}`;
  const userId = await redis.get(key);

  if (!userId) {
    throw new AuthError('Token inválido ou expirado', 401);
  }

  await redis.del(key);

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.status !== 'ACTIVE') {
    throw new AuthError('Conta inativa', 403);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  logger.info({ userId }, 'Password reset completed');
}

// ─── Accept invite ──────────────────────────────────────────────────

export async function acceptInvite(token: string, password: string): Promise<AuthTokens> {
  const key = `${INVITE_PREFIX}${token}`;
  const userId = await redis.get(key);

  if (!userId) {
    throw new AuthError('Token inválido ou expirado', 401);
  }

  await redis.del(key);

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AuthError('Usuário não encontrado', 401);
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = crypto.randomUUID();
  await saveRefreshToken(refreshToken, user.id);

  logger.info({ userId }, 'Invite accepted, password set');

  return { accessToken, refreshToken };
}
