import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { FieldTeamError } from './field-teams.types';
import {
  createFieldTeam,
  listFieldTeams,
  getFieldTeam,
  updateFieldTeam,
  deleteFieldTeam,
  getTeamTypes,
} from './field-teams.service';

export const fieldTeamsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new FieldTeamError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof FieldTeamError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── TYPES ──────────────────────────────────────────────────────────

fieldTeamsRouter.get(
  '/org/farms/:farmId/field-teams/types',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (_req, res) => {
    try {
      res.json(getTeamTypes());
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

fieldTeamsRouter.post(
  '/org/farms/:farmId/field-teams',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createFieldTeam(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_FIELD_TEAM',
        targetType: 'field_team',
        targetId: result.id,
        metadata: { farmId: req.params.farmId, teamType: result.teamType, name: result.name },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

fieldTeamsRouter.get(
  '/org/farms/:farmId/field-teams',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listFieldTeams(ctx, req.params.farmId as string, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        teamType: (req.query.teamType as string) || undefined,
        search: (req.query.search as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

fieldTeamsRouter.get(
  '/org/farms/:farmId/field-teams/:teamId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getFieldTeam(
        ctx,
        req.params.farmId as string,
        req.params.teamId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

fieldTeamsRouter.patch(
  '/org/farms/:farmId/field-teams/:teamId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateFieldTeam(
        ctx,
        req.params.farmId as string,
        req.params.teamId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_FIELD_TEAM',
        targetType: 'field_team',
        targetId: result.id,
        metadata: { farmId: req.params.farmId, name: result.name },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

fieldTeamsRouter.delete(
  '/org/farms/:farmId/field-teams/:teamId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteFieldTeam(ctx, req.params.farmId as string, req.params.teamId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_FIELD_TEAM',
        targetType: 'field_team',
        targetId: req.params.teamId as string,
        metadata: { farmId: req.params.farmId },
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
