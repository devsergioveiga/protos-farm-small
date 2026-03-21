import cron from 'node-cron';
import { redis } from '../../database/redis';
import { processOverduePlans } from '../../modules/maintenance-plans/maintenance-plans.service';
import { logger } from '../utils/logger';

export function startMaintenanceAlertsCron(): void {
  cron.schedule(
    '0 6 * * *', // Daily at 06:00 BRT
    async () => {
      const lockKey = `cron:maintenance-alerts:${new Date().toISOString().slice(0, 10)}`;
      const locked = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
      if (!locked) {
        logger.info('Maintenance alerts cron: another instance is running, skipping');
        return;
      }
      try {
        logger.info('Maintenance alerts cron: starting');
        const count = await processOverduePlans();
        logger.info({ count }, 'Maintenance alerts cron: completed');
      } catch (err) {
        logger.error({ err }, 'Maintenance alerts cron: failed');
      } finally {
        await redis.del(lockKey);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
