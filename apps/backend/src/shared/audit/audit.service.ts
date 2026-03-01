import { Prisma, UserRole } from '@prisma/client';
import { withRlsBypass } from '../../database/rls';
import { logger } from '../utils/logger';

export interface AuditEntry {
  actorId: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  farmId?: string;
  organizationId?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await withRlsBypass(async (tx) => {
      await tx.auditLog.create({ data: entry });
    });
  } catch (err) {
    logger.error({ err, entry }, 'Failed to write audit log');
  }
}
