import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { TeamOperationError } from './team-operations.types';
import {
  createTeamOperation,
  listTeamOperations,
  getTeamOperation,
  deleteTeamOperation,
  getOperationTypes,
  getCostByPlot,
  getTimesheet,
} from './team-operations.service';

export const teamOperationsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new TeamOperationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof TeamOperationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── TYPES ──────────────────────────────────────────────────────────

teamOperationsRouter.get(
  '/org/farms/:farmId/team-operations/types',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (_req, res) => {
    try {
      res.json(getOperationTypes());
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA9: COST BY PLOT ─────────────────────────────────────────────

teamOperationsRouter.get(
  '/org/farms/:farmId/team-operations/cost-by-plot',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCostByPlot(ctx, req.params.farmId as string, {
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA8: TIMESHEET ────────────────────────────────────────────────

teamOperationsRouter.get(
  '/org/farms/:farmId/team-operations/timesheet',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getTimesheet(ctx, req.params.farmId as string, {
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
        userId: (req.query.userId as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

teamOperationsRouter.post(
  '/org/farms/:farmId/team-operations',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createTeamOperation(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_TEAM_OPERATION',
        targetType: 'team_operation',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          teamId: result.teamId,
          operationType: result.operationType,
          entryCount: result.entryCount,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

teamOperationsRouter.get(
  '/org/farms/:farmId/team-operations',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listTeamOperations(ctx, req.params.farmId as string, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        teamId: (req.query.teamId as string) || undefined,
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        operationType: (req.query.operationType as string) || undefined,
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

teamOperationsRouter.get(
  '/org/farms/:farmId/team-operations/:operationId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getTeamOperation(
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

// ─── DELETE (soft) ──────────────────────────────────────────────────

teamOperationsRouter.delete(
  '/org/farms/:farmId/team-operations/:operationId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteTeamOperation(ctx, req.params.farmId as string, req.params.operationId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_TEAM_OPERATION',
        targetType: 'team_operation',
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
