import cron from 'node-cron';
import { redis } from '../../database/redis';
import { sendDigestEmails } from '../mail/digest-mail.service';
import { logger } from '../utils/logger';

export function startDigestCron(): void {
  cron.schedule(
    '0 7 * * *',
    async () => {
      const lockKey = 'cron:daily-digest';
      const locked = await redis.set(lockKey, '1', 'EX', 120, 'NX');
      if (!locked) {
        logger.info('Daily digest cron: another instance is running, skipping');
        return;
      }
      try {
        logger.info('Daily digest cron: starting');
        await sendDigestEmails();
        logger.info('Daily digest cron: completed');
      } catch (err) {
        logger.error({ err }, 'Daily digest cron: failed');
      } finally {
        await redis.del(lockKey);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
