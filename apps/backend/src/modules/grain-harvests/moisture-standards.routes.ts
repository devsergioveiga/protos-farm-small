import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { GrainHarvestError } from './grain-harvests.types';
import {
  listMoistureStandards,
  upsertMoistureStandard,
  deleteMoistureStandard,
} from './moisture-standards.service';

export const moistureStandardsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new GrainHarvestError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof GrainHarvestError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── LIST ───────────────────────────────────────────────────────────

moistureStandardsRouter.get(
  '/org/moisture-standards',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listMoistureStandards(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPSERT ─────────────────────────────────────────────────────────

moistureStandardsRouter.put(
  '/org/moisture-standards',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await upsertMoistureStandard(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPSERT_MOISTURE_STANDARD',
        targetType: 'moisture_standard',
        targetId: result.id,
        metadata: { crop: result.crop, moisturePct: result.moisturePct },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

moistureStandardsRouter.delete(
  '/org/moisture-standards/:standardId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteMoistureStandard(ctx, req.params.standardId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_MOISTURE_STANDARD',
        targetType: 'moisture_standard',
        targetId: req.params.standardId as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
