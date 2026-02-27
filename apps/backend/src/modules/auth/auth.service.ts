import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { redis } from '../../database/redis';
import { loadEnv } from '../../config/env';

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
