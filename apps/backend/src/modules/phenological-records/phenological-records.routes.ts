import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { PhenoRecordError } from './phenological-records.types';
import {
  listPhenoRecords,
  getCurrentStage,
  createPhenoRecord,
  deletePhenoRecord,
} from './phenological-records.service';

export const phenologicalRecordsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PhenoRecordError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof PhenoRecordError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── LIST ────────────────────────────────────────────────────────────

phenologicalRecordsRouter.get(
  '/org/phenological-records',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listPhenoRecords(ctx, {
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        crop: (req.query.crop as string) || undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CURRENT STAGE ──────────────────────────────────────────────────

phenologicalRecordsRouter.get(
  '/org/phenological-records/current/:fieldPlotId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCurrentStage(
        ctx,
        req.params.fieldPlotId as string,
        (req.query.crop as string) || undefined,
      );
      if (!result) {
        res.status(404).json({ error: 'Nenhum registro fenológico encontrado para este talhão' });
        return;
      }
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ──────────────────────────────────────────────────────────

phenologicalRecordsRouter.post(
  '/org/phenological-records',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createPhenoRecord(ctx, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_PHENOLOGICAL_RECORD',
        targetType: 'plot_phenological_record',
        targetId: result.id,
        metadata: {
          fieldPlotId: result.fieldPlotId,
          crop: result.crop,
          stageCode: result.stageCode,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ──────────────────────────────────────────────────────────

phenologicalRecordsRouter.delete(
  '/org/phenological-records/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deletePhenoRecord(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PHENOLOGICAL_RECORD',
        targetType: 'plot_phenological_record',
        targetId: req.params.id as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
