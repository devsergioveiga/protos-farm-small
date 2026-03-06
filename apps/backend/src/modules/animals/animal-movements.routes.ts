import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import type { RlsContext } from '../../database/rls';
import { AnimalMovementsError } from './animal-movements.types';
import { listAnimalMovements, getAnimalMovementStats } from './animal-movements.service';

export const animalMovementsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new AnimalMovementsError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

// ─── STATS (before parameterized routes) ─────────────────────────────

animalMovementsRouter.get(
  '/org/farms/:farmId/animals/:animalId/movements/stats',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const stats = await getAnimalMovementStats(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );
      res.json(stats);
    } catch (err) {
      if (err instanceof AnimalMovementsError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

animalMovementsRouter.get(
  '/org/farms/:farmId/animals/:animalId/movements',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const data = await listAnimalMovements(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );
      res.json(data);
    } catch (err) {
      if (err instanceof AnimalMovementsError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
