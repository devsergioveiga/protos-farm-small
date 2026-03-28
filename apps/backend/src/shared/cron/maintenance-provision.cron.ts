import cron from 'node-cron';
import { redis } from '../../database/redis';
import { processMonthlyProvisions } from '../../modules/maintenance-provisions/maintenance-provisions.service';
import { logger } from '../utils/logger';

export function startMaintenanceProvisionCron(): void {
  // Run at 02:00 on the 1st of every month (BRT timezone)
  cron.schedule(
    '0 2 1 * *',
    async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const lockKey = `cron:maintenance-provision:${year}-${month}`;

      const locked = await redis.set(lockKey, '1', 'EX', 300, 'NX');
      if (!locked) {
        logger.info('Maintenance provision cron: another instance is running, skipping');
        return;
      }

      try {
        logger.info(`Maintenance provision cron: starting for ${year}-${month}`);
        await processMonthlyProvisions();
        logger.info(`Maintenance provision cron: completed for ${year}-${month}`);
      } catch (err) {
        logger.error({ err }, 'Maintenance provision cron: failed');
      } finally {
        await redis.del(lockKey);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
