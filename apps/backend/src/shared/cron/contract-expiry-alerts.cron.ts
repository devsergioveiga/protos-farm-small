import cron from 'node-cron';
import { redis } from '../../database/redis';
import { prisma } from '../../database/prisma';
import { withRlsBypass } from '../../database/rls';
import { createNotification } from '../../modules/notifications/notifications.service';
import { logger } from '../utils/logger';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function differenceInDays(future: Date, now: Date): number {
  return Math.floor((future.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function startContractExpiryAlertsCron(): void {
  cron.schedule(
    '0 7 * * *', // Daily at 07:00 BRT
    async () => {
      const today = new Date().toISOString().slice(0, 10);
      const lockKey = `cron:contract-expiry:${today}`;

      // Redis lock for idempotency — prevents duplicate alerts on server restart (Pitfall 5)
      const locked = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
      if (!locked) {
        logger.info('Contract expiry cron: another instance is running, skipping');
        return;
      }

      try {
        logger.info('Contract expiry cron: starting');

        const now = new Date();
        const thirtyDaysLater = addDays(now, 30);

        const expiringContracts = await prisma.employeeContract.findMany({
          where: {
            isActive: true,
            endDate: { gte: now, lte: thirtyDaysLater },
            contractType: { in: ['TRIAL', 'SEASONAL'] },
          },
          include: {
            employee: { select: { name: true, organizationId: true } },
            position: { select: { name: true } },
          },
        });

        logger.info({ count: expiringContracts.length }, 'Contract expiry cron: contracts found');

        let notified = 0;

        for (const contract of expiringContracts) {
          try {
            const daysUntil = differenceInDays(new Date(contract.endDate!), now);
            const typeLabel = contract.contractType === 'TRIAL' ? 'experiência' : 'safra';

            // Find managers of the organization to notify
            const managers = await prisma.user.findMany({
              where: {
                organizationId: contract.employee.organizationId,
                role: { in: ['ADMIN', 'MANAGER'] },
                status: 'ACTIVE',
              },
              select: { id: true },
            });

            await withRlsBypass(async (tx) => {
              for (const manager of managers) {
                await createNotification(tx, contract.employee.organizationId, {
                  recipientId: manager.id,
                  type: 'CONTRACT_EXPIRY',
                  title: `Contrato de ${typeLabel} vence em ${daysUntil} dias`,
                  body: `${contract.employee.name} — ${contract.position.name}`,
                  referenceId: contract.id,
                  referenceType: 'employee_contract',
                });
              }
            });

            notified++;
          } catch (err) {
            logger.error(
              { err, contractId: contract.id },
              'Contract expiry cron: failed to notify for contract',
            );
          }
        }

        logger.info({ notified }, 'Contract expiry cron: completed');
      } catch (error) {
        logger.error({ err: error }, '[contract-expiry-alerts] cron failed');
      } finally {
        // Release lock after completion
        await redis.del(lockKey);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
