import cron from 'node-cron';
import { redis } from '../../database/redis';
import { prisma } from '../../database/prisma';
import { withRlsBypass } from '../../database/rls';
import { createNotification } from '../../modules/notifications/notifications.service';
import { logger } from '../utils/logger';
import type { NotificationType } from '../../modules/notifications/notifications.types';

function differenceInDays(future: Date, now: Date): number {
  return Math.ceil((future.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function startTaxGuideAlertsCron(): void {
  cron.schedule(
    '0 7 * * *', // Daily at 07:00 BRT
    async () => {
      const today = new Date().toISOString().slice(0, 10);
      const lockKey = `cron:tax-guide-alerts:${today}`;

      // Redis lock for idempotency — prevents duplicate alerts on server restart (Pitfall 8)
      const locked = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
      if (!locked) {
        logger.info('Tax guide alerts cron: another instance is running, skipping');
        return;
      }

      try {
        logger.info('Tax guide alerts cron: starting');

        const now = new Date();
        const in10days = new Date(now);
        in10days.setDate(in10days.getDate() + 10);

        // Find guides due within 10 days that are not PAID
        const guides = await prisma.taxGuide.findMany({
          where: {
            status: { notIn: ['PAID'] },
            dueDate: { gte: now, lte: in10days },
          },
          select: {
            id: true,
            organizationId: true,
            guideType: true,
            dueDate: true,
            totalAmount: true,
          },
        });

        logger.info({ count: guides.length }, 'Tax guide alerts cron: guides found');

        const notificationType: NotificationType = 'TAX_GUIDE_DUE';
        let notified = 0;

        for (const guide of guides) {
          try {
            const daysUntilDue = differenceInDays(new Date(guide.dueDate), now);
            const typeLabel = guide.guideType.toString();
            const title = `Vencimento ${typeLabel}`;
            const body =
              daysUntilDue <= 5
                ? `Guia ${typeLabel} vence em ${daysUntilDue} dia(s) — R$ ${guide.totalAmount}`
                : `Guia ${typeLabel} vence em ${daysUntilDue} dias — R$ ${guide.totalAmount}`;

            // Find managers of the organization to notify
            const managers = await prisma.user.findMany({
              where: {
                organizationId: guide.organizationId,
                role: { in: ['ADMIN', 'MANAGER'] },
                status: 'ACTIVE',
              },
              select: { id: true },
            });

            await withRlsBypass(async (tx) => {
              for (const manager of managers) {
                await createNotification(tx, guide.organizationId, {
                  recipientId: manager.id,
                  type: notificationType,
                  title,
                  body,
                  referenceId: guide.id,
                  referenceType: 'tax_guide',
                });
              }
            });

            notified++;
          } catch (err) {
            logger.error(
              { err, guideId: guide.id },
              'Tax guide alerts cron: failed to notify for guide',
            );
          }
        }

        logger.info({ notified }, 'Tax guide alerts cron: completed');
      } catch (error) {
        logger.error({ err: error }, '[tax-guide-alerts] cron failed');
      } finally {
        // Release lock after completion
        await redis.del(lockKey);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
