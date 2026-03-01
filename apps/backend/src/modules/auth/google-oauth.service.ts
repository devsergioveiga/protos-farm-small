import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { withRlsBypass } from '../../database/rls';
import { redis } from '../../database/redis';
import { loadEnv } from '../../config/env';
import { logger } from '../../shared/utils/logger';
import { createSessionForUser, AuthError, type AuthTokens } from './auth.service';

// ─── Redis prefixes ──────────────────────────────────────────────────

const GOOGLE_STATE_PREFIX = 'google_state:';
const GOOGLE_EXCHANGE_PREFIX = 'google_exchange:';

// ─── Helpers ─────────────────────────────────────────────────────────

function isGoogleConfigured(): boolean {
  const env = loadEnv();
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

function getOAuth2Client(): OAuth2Client {
  const env = loadEnv();
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

// ─── Build auth URL ──────────────────────────────────────────────────

export async function buildGoogleAuthUrl(): Promise<string> {
  if (!isGoogleConfigured()) {
    throw new AuthError('Login com Google não está configurado', 503);
  }

  const client = getOAuth2Client();
  const state = crypto.randomUUID();

  await redis.set(`${GOOGLE_STATE_PREFIX}${state}`, '1', 'EX', 600);

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });

  return url;
}

// ─── Handle Google callback ──────────────────────────────────────────

export async function handleGoogleCallback(code: string, state: string): Promise<string> {
  if (!isGoogleConfigured()) {
    throw new AuthError('Login com Google não está configurado', 503);
  }

  // Validate CSRF state
  const stateKey = `${GOOGLE_STATE_PREFIX}${state}`;
  const stateValid = await redis.get(stateKey);
  if (!stateValid) {
    throw new AuthError('Estado inválido ou expirado', 400);
  }
  await redis.del(stateKey);

  // Exchange authorization code for tokens
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) {
    throw new AuthError('Não foi possível obter informações do Google', 400);
  }

  // Verify id_token and extract email
  const env = loadEnv();
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new AuthError('Não foi possível obter o email do Google', 400);
  }

  const googleSub = payload.sub;
  if (!googleSub) {
    throw new AuthError('Não foi possível obter o identificador do Google', 400);
  }

  // Look up user by email (no auto-registration — CA2 constraint)
  const user = await withRlsBypass(async (tx) => {
    const u = await tx.user.findUnique({ where: { email: payload.email } });
    if (!u) {
      throw new AuthError('Email não cadastrado no sistema', 403);
    }

    if (u.status !== 'ACTIVE') {
      throw new AuthError('Conta inativa', 403);
    }

    // CA5: Check if organization allows social login
    if (u.role !== 'SUPER_ADMIN') {
      const org = await tx.organization.findUnique({ where: { id: u.organizationId } });
      if (org && !org.allowSocialLogin) {
        throw new AuthError('Login social desabilitado para esta organização', 403);
      }
    }

    // CA3: Link Google account on first social login, verify on subsequent logins
    if (!u.googleId) {
      await tx.user.update({
        where: { id: u.id },
        data: { googleId: googleSub },
      });
      logger.info({ userId: u.id, googleSub }, 'Google account linked to user');
    } else if (u.googleId !== googleSub) {
      throw new AuthError('Esta conta está vinculada a outra conta Google', 403);
    }

    return u;
  });

  // Create session
  const authTokens = await createSessionForUser(user);

  // Generate one-time exchange code (60s TTL)
  const exchangeCode = crypto.randomUUID();
  await redis.set(`${GOOGLE_EXCHANGE_PREFIX}${exchangeCode}`, JSON.stringify(authTokens), 'EX', 60);

  logger.info({ userId: user.id, email: payload.email }, 'Google OAuth login successful');

  return exchangeCode;
}

// ─── Exchange one-time code for tokens ───────────────────────────────

export async function exchangeGoogleCode(code: string): Promise<AuthTokens> {
  const key = `${GOOGLE_EXCHANGE_PREFIX}${code}`;
  const data = await redis.get(key);

  if (!data) {
    throw new AuthError('Código inválido ou expirado', 401);
  }

  await redis.del(key);

  return JSON.parse(data) as AuthTokens;
}

export { isGoogleConfigured };
