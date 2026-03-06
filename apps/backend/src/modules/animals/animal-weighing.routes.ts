import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { AnimalWeighingError } from './animal-weighing.types';
import {
  listWeighings,
  createWeighing,
  updateWeighing,
  deleteWeighing,
  getWeighingStats,
  exportWeighingsCsv,
} from './animal-weighing.service';

export const animalWeighingRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new AnimalWeighingError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

// ─── STATS (before :weighingId to avoid route conflict) ─────────────

animalWeighingRouter.get(
  '/org/farms/:farmId/animals/:animalId/weighings/stats',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const stats = await getWeighingStats(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );
      res.json(stats);
    } catch (err) {
      if (err instanceof AnimalWeighingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── EXPORT CSV ─────────────────────────────────────────────────────

animalWeighingRouter.get(
  '/org/farms/:farmId/animals/:animalId/weighings/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportWeighingsCsv(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="pesagens-${req.params.animalId as string}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      if (err instanceof AnimalWeighingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

animalWeighingRouter.get(
  '/org/farms/:farmId/animals/:animalId/weighings',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const data = await listWeighings(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );
      res.json(data);
    } catch (err) {
      if (err instanceof AnimalWeighingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

animalWeighingRouter.post(
  '/org/farms/:farmId/animals/:animalId/weighings',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { weightKg, measuredAt, bodyConditionScore, notes } = req.body;

      const weighing = await createWeighing(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        req.user!.userId,
        { weightKg, measuredAt, bodyConditionScore, notes },
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_WEIGHING',
        targetType: 'animal_weighing',
        targetId: weighing.id,
        metadata: {
          animalId: req.params.animalId as string,
          weightKg,
          measuredAt,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(weighing);
    } catch (err) {
      if (err instanceof AnimalWeighingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

animalWeighingRouter.patch(
  '/org/farms/:farmId/animals/:animalId/weighings/:weighingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const weighing = await updateWeighing(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        req.params.weighingId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_WEIGHING',
        targetType: 'animal_weighing',
        targetId: weighing.id,
        metadata: {
          changes: Object.keys(req.body),
          animalId: req.params.animalId as string,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json(weighing);
    } catch (err) {
      if (err instanceof AnimalWeighingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

animalWeighingRouter.delete(
  '/org/farms/:farmId/animals/:animalId/weighings/:weighingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteWeighing(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        req.params.weighingId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_WEIGHING',
        targetType: 'animal_weighing',
        targetId: req.params.weighingId as string,
        metadata: {
          animalId: req.params.animalId as string,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Pesagem excluída com sucesso' });
    } catch (err) {
      if (err instanceof AnimalWeighingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
