import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { AnimalLotError } from './animal-lots.types';
import {
  createLot,
  listLots,
  getLot,
  updateLot,
  softDeleteLot,
  moveAnimalsToLot,
  removeAnimalsFromLot,
  getLotDashboard,
  getLotCompositionHistory,
  getLotsWithCapacityAlerts,
} from './animal-lots.service';

export const animalLotsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new AnimalLotError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

// ─── Capacity Alerts (before :lotId to avoid route conflict) ────────

animalLotsRouter.get(
  '/org/farms/:farmId/lots/alerts',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const alerts = await getLotsWithCapacityAlerts(ctx, req.params.farmId);
      res.json(alerts);
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

animalLotsRouter.post(
  '/org/farms/:farmId/lots',
  authenticate,
  checkPermission('animals:create'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const {
        name,
        predominantCategory,
        currentLocation,
        locationType,
        maxCapacity,
        description,
        notes,
      } = req.body;

      if (!name || !predominantCategory || !currentLocation || !locationType) {
        res.status(400).json({
          error: 'Campos obrigatórios: name, predominantCategory, currentLocation, locationType',
        });
        return;
      }

      const lot = await createLot(ctx, req.params.farmId, {
        name,
        predominantCategory,
        currentLocation,
        locationType,
        maxCapacity,
        description,
        notes,
      });

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_LOT',
        targetType: 'animal_lot',
        targetId: lot.id,
        metadata: { name, predominantCategory, locationType, farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(lot);
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

animalLotsRouter.get(
  '/org/farms/:farmId/lots',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        category: req.query.category as string | undefined,
        locationType: req.query.locationType as string | undefined,
      };
      const result = await listLots(ctx, req.params.farmId, query);
      res.json(result);
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

animalLotsRouter.get(
  '/org/farms/:farmId/lots/:lotId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const lot = await getLot(ctx, req.params.farmId, req.params.lotId);
      res.json(lot);
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

animalLotsRouter.patch(
  '/org/farms/:farmId/lots/:lotId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const lot = await updateLot(ctx, req.params.farmId, req.params.lotId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_LOT',
        targetType: 'animal_lot',
        targetId: lot.id,
        metadata: { changes: Object.keys(req.body), farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId,
        organizationId: ctx.organizationId,
      });

      res.json(lot);
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

animalLotsRouter.delete(
  '/org/farms/:farmId/lots/:lotId',
  authenticate,
  checkPermission('animals:delete'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await softDeleteLot(ctx, req.params.farmId, req.params.lotId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_LOT',
        targetType: 'animal_lot',
        targetId: req.params.lotId,
        metadata: { farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Lote excluído com sucesso' });
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── MOVE ANIMALS TO LOT ────────────────────────────────────────────

animalLotsRouter.post(
  '/org/farms/:farmId/lots/:lotId/move',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { animalIds, reason } = req.body;

      if (!animalIds || !Array.isArray(animalIds)) {
        res.status(400).json({ error: 'animalIds é obrigatório e deve ser um array' });
        return;
      }

      const result = await moveAnimalsToLot(
        ctx,
        req.params.farmId,
        req.user!.userId,
        req.params.lotId,
        { animalIds, reason },
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'MOVE_ANIMALS_TO_LOT',
        targetType: 'animal_lot',
        targetId: req.params.lotId,
        metadata: { animalIds, reason, moved: result.moved, farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId,
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── REMOVE ANIMALS FROM LOT ────────────────────────────────────────

animalLotsRouter.post(
  '/org/farms/:farmId/lots/:lotId/remove',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { animalIds, reason } = req.body;

      if (!animalIds || !Array.isArray(animalIds)) {
        res.status(400).json({ error: 'animalIds é obrigatório e deve ser um array' });
        return;
      }

      const result = await removeAnimalsFromLot(
        ctx,
        req.params.farmId,
        req.user!.userId,
        req.params.lotId,
        { animalIds, reason },
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'REMOVE_ANIMALS_FROM_LOT',
        targetType: 'animal_lot',
        targetId: req.params.lotId,
        metadata: { animalIds, reason, removed: result.removed, farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId,
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── DASHBOARD ──────────────────────────────────────────────────────

animalLotsRouter.get(
  '/org/farms/:farmId/lots/:lotId/dashboard',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const dashboard = await getLotDashboard(ctx, req.params.farmId, req.params.lotId);
      res.json(dashboard);
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── HISTORY ────────────────────────────────────────────────────────

animalLotsRouter.get(
  '/org/farms/:farmId/lots/:lotId/history',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const history = await getLotCompositionHistory(ctx, req.params.farmId, req.params.lotId);
      res.json(history);
    } catch (err) {
      if (err instanceof AnimalLotError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
