import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { FarmError } from './farms.types';
import {
  listCropSeasons,
  createCropSeason,
  updateCropSeason,
  deleteCropSeason,
  listSoilAnalyses,
  createSoilAnalysis,
  updateSoilAnalysis,
  deleteSoilAnalysis,
  getRotationIndicator,
  exportPlotHistory,
} from './plot-history.service';

export const plotHistoryRouter = Router({ mergeParams: true });

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new FarmError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

// ─── Crop Seasons ───────────────────────────────────────────────────

// GET /crop-seasons
plotHistoryRouter.get(
  '/crop-seasons',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listCropSeasons(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// POST /crop-seasons
plotHistoryRouter.post(
  '/crop-seasons',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createCropSeason(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_CROP_SEASON',
        targetType: 'plot_crop_season',
        targetId: result.id,
        metadata: {
          plotId: req.params.plotId,
          crop: req.body.crop,
          seasonYear: req.body.seasonYear,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.status(201).json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// PATCH /crop-seasons/:seasonId
plotHistoryRouter.patch(
  '/crop-seasons/:seasonId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateCropSeason(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
        req.params.seasonId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_CROP_SEASON',
        targetType: 'plot_crop_season',
        targetId: req.params.seasonId as string,
        metadata: { plotId: req.params.plotId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// DELETE /crop-seasons/:seasonId
plotHistoryRouter.delete(
  '/crop-seasons/:seasonId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await deleteCropSeason(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
        req.params.seasonId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_CROP_SEASON',
        targetType: 'plot_crop_season',
        targetId: req.params.seasonId as string,
        metadata: { plotId: req.params.plotId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── Soil Analyses ──────────────────────────────────────────────────

// GET /soil-analyses
plotHistoryRouter.get(
  '/soil-analyses',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listSoilAnalyses(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// POST /soil-analyses
plotHistoryRouter.post(
  '/soil-analyses',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createSoilAnalysis(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_SOIL_ANALYSIS',
        targetType: 'plot_soil_analysis',
        targetId: result.id,
        metadata: { plotId: req.params.plotId, analysisDate: req.body.analysisDate },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.status(201).json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// PATCH /soil-analyses/:analysisId
plotHistoryRouter.patch(
  '/soil-analyses/:analysisId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateSoilAnalysis(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
        req.params.analysisId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_SOIL_ANALYSIS',
        targetType: 'plot_soil_analysis',
        targetId: req.params.analysisId as string,
        metadata: { plotId: req.params.plotId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// DELETE /soil-analyses/:analysisId
plotHistoryRouter.delete(
  '/soil-analyses/:analysisId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await deleteSoilAnalysis(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
        req.params.analysisId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_SOIL_ANALYSIS',
        targetType: 'plot_soil_analysis',
        targetId: req.params.analysisId as string,
        metadata: { plotId: req.params.plotId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── Rotation Indicator ─────────────────────────────────────────────

// GET /rotation-indicator
plotHistoryRouter.get(
  '/rotation-indicator',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getRotationIndicator(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── Export ─────────────────────────────────────────────────────────

// GET /history/export
plotHistoryRouter.get(
  '/history/export',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportPlotHistory(
        ctx,
        req.params.farmId as string,
        req.params.plotId as string,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="historico-talhao-${req.params.plotId}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
