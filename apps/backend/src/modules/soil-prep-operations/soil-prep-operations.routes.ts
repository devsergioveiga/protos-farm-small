import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { SoilPrepError } from './soil-prep-operations.types';
import {
  createSoilPrepOperation,
  listSoilPrepOperations,
  getSoilPrepOperation,
  updateSoilPrepOperation,
  deleteSoilPrepOperation,
  createSoilPrepBulk,
} from './soil-prep-operations.service';

export const soilPrepRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new SoilPrepError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof SoilPrepError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

soilPrepRouter.post(
  '/org/farms/:farmId/soil-prep-operations',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createSoilPrepOperation(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_SOIL_PREP_OPERATION',
        targetType: 'soil_prep_operation',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          operationTypeName: result.operationTypeName,
          fieldPlotId: result.fieldPlotId,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── BULK CREATE (CA8) ──────────────────────────────────────────────

soilPrepRouter.post(
  '/org/farms/:farmId/soil-prep-operations/bulk',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { fieldPlotIds, ...input } = req.body;

      if (!Array.isArray(fieldPlotIds) || fieldPlotIds.length === 0) {
        res.status(400).json({ error: 'fieldPlotIds é obrigatório e deve ser um array' });
        return;
      }

      const results = await createSoilPrepBulk(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        fieldPlotIds,
        input,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_CREATE_SOIL_PREP_OPERATION',
        targetType: 'soil_prep_operation',
        targetId: results.map((r) => r.id).join(','),
        metadata: {
          farmId: req.params.farmId,
          operationTypeName: input.operationTypeName,
          plotCount: fieldPlotIds.length,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json({ data: results, count: results.length });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

soilPrepRouter.get(
  '/org/farms/:farmId/soil-prep-operations',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listSoilPrepOperations(ctx, req.params.farmId as string, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        search: (req.query.search as string) || undefined,
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

soilPrepRouter.get(
  '/org/farms/:farmId/soil-prep-operations/:operationId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getSoilPrepOperation(
        ctx,
        req.params.farmId as string,
        req.params.operationId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

soilPrepRouter.patch(
  '/org/farms/:farmId/soil-prep-operations/:operationId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateSoilPrepOperation(
        ctx,
        req.params.farmId as string,
        req.params.operationId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_SOIL_PREP_OPERATION',
        targetType: 'soil_prep_operation',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          operationTypeName: result.operationTypeName,
        },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE (soft) ──────────────────────────────────────────────────

soilPrepRouter.delete(
  '/org/farms/:farmId/soil-prep-operations/:operationId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteSoilPrepOperation(
        ctx,
        req.params.farmId as string,
        req.params.operationId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_SOIL_PREP_OPERATION',
        targetType: 'soil_prep_operation',
        targetId: req.params.operationId as string,
        metadata: { farmId: req.params.farmId },
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
