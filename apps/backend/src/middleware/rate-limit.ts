import { Request, Response, NextFunction } from 'express';
import { redis } from '../database/redis';
import { logger } from '../shared/utils/logger';

const IP_RATE_PREFIX = 'login_rate:ip:';
const EMAIL_BLOCK_PREFIX = 'login_block:';
const EMAIL_FAILURES_PREFIX = 'login_failures:';

const MAX_ATTEMPTS_PER_MINUTE = 5;
const IP_WINDOW_SECONDS = 60;
const MAX_FAILURES_BEFORE_BLOCK = 10;
const BLOCK_DURATION_SECONDS = 900; // 15 minutes

export function loginRateLimit() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      const email = req.body?.email?.toLowerCase();

      // Check IP rate limit (5 attempts per minute)
      const ipKey = `${IP_RATE_PREFIX}${ip}`;
      const ipAttempts = await redis.incr(ipKey);
      if (ipAttempts === 1) {
        await redis.expire(ipKey, IP_WINDOW_SECONDS);
      }

      if (ipAttempts > MAX_ATTEMPTS_PER_MINUTE) {
        logger.warn({ ip }, 'Login rate limit exceeded by IP');
        res.status(429).json({
          error: 'Muitas tentativas de login. Aguarde um momento antes de tentar novamente.',
        });
        return;
      }

      // Check email block (10 failures → 15min block)
      if (email) {
        const blockKey = `${EMAIL_BLOCK_PREFIX}${email}`;
        const blocked = await redis.exists(blockKey);

        if (blocked) {
          const ttl = await redis.ttl(blockKey);
          logger.warn({ email }, 'Login attempt on blocked email');
          res.status(429).json({
            error: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${Math.ceil(ttl / 60)} minutos.`,
          });
          return;
        }
      }

      next();
    } catch (err) {
      logger.error({ err }, 'Rate limit check failed, allowing request');
      next();
    }
  };
}

export async function incrementLoginFailures(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const failuresKey = `${EMAIL_FAILURES_PREFIX}${normalizedEmail}`;

  const failures = await redis.incr(failuresKey);
  if (failures === 1) {
    await redis.expire(failuresKey, BLOCK_DURATION_SECONDS);
  }

  if (failures >= MAX_FAILURES_BEFORE_BLOCK) {
    const blockKey = `${EMAIL_BLOCK_PREFIX}${normalizedEmail}`;
    await redis.set(blockKey, '1', 'EX', BLOCK_DURATION_SECONDS);
    await redis.del(failuresKey);
    logger.warn(
      { email: normalizedEmail, failures },
      'Email blocked after too many login failures',
    );
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  await redis.del(`${EMAIL_FAILURES_PREFIX}${normalizedEmail}`);
}
