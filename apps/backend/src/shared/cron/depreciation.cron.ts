import cron from 'node-cron';
import { redis } from '../../database/redis';
import { prisma } from '../../database/prisma';
import { runDepreciationBatch } from '../../modules/depreciation/depreciation-batch.service';
import { logger } from '../utils/logger';

export function startDepreciationCron(): void {
  cron.schedule(
    '0 2 1 * *',
    async () => {
      const now = new Date();
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const lockKey = `cron:depreciation:${prevYear}-${prevMonth}`;
      const locked = await redis.set(lockKey, '1', 'EX', 600, 'NX');
      if (!locked) {
        logger.info('Depreciation cron: another instance is running, skipping');
        return;
      }
      try {
        logger.info('Depreciation cron: starting batch');

        // Enumerate all organizations
        const orgs = await prisma.organization.findMany({ select: { id: true } });
        logger.info(`Depreciation cron: processing ${orgs.length} organizations`);

        for (const org of orgs) {
          try {
            // Process FISCAL track
            await runDepreciationBatch({
              organizationId: org.id,
              periodYear: prevYear,
              periodMonth: prevMonth,
              track: 'FISCAL',
              triggeredBy: 'cron',
            });
            // Process MANAGERIAL track
            await runDepreciationBatch({
              organizationId: org.id,
              periodYear: prevYear,
              periodMonth: prevMonth,
              track: 'MANAGERIAL',
              triggeredBy: 'cron',
            });
          } catch (err) {
            // Log per-org failure but continue with other orgs
            logger.error({ err, orgId: org.id }, 'Depreciation cron: failed for org');
          }
        }

        logger.info('Depreciation cron: completed');
      } catch (err) {
        logger.error({ err }, 'Depreciation cron: failed');
      } finally {
        await redis.del(lockKey);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
