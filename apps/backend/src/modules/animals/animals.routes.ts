import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { AnimalError } from './animals.types';
import {
  createAnimal,
  listAnimals,
  getAnimal,
  updateAnimal,
  softDeleteAnimal,
  getAnimalsSummary,
  listBreeds,
  createBreed,
  deleteBreed,
} from './animals.service';

export const animalsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new AnimalError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

// ─── Breed Routes (org-level, no farmId) ────────────────────────────

animalsRouter.get(
  '/org/breeds',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const breeds = await listBreeds(ctx);
      res.json(breeds);
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

animalsRouter.post(
  '/org/breeds',
  authenticate,
  checkPermission('animals:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { name, code, species, category } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Nome da raça é obrigatório' });
        return;
      }

      const breed = await createBreed(ctx, { name, code, species, category });

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_BREED',
        targetType: 'breed',
        targetId: breed.id,
        metadata: { name },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(breed);
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

animalsRouter.delete(
  '/org/breeds/:breedId',
  authenticate,
  checkPermission('animals:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteBreed(ctx, req.params.breedId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_BREED',
        targetType: 'breed',
        targetId: req.params.breedId,
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(204).send();
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── Animal Routes (farm-scoped) ────────────────────────────────────

animalsRouter.post(
  '/org/farms/:farmId/animals',
  authenticate,
  checkPermission('animals:create'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { farmId } = req.params;
      const { earTag, sex } = req.body;

      if (!earTag) {
        res.status(400).json({ error: 'Brinco é obrigatório' });
        return;
      }
      if (!sex) {
        res.status(400).json({ error: 'Sexo é obrigatório' });
        return;
      }

      const animal = await createAnimal(ctx, farmId, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_ANIMAL',
        targetType: 'animal',
        targetId: animal.id,
        metadata: { earTag, sex, farmId },
        ipAddress: getClientIp(req),
        farmId,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(animal);
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// Summary must be before :animalId
animalsRouter.get(
  '/org/farms/:farmId/animals/summary',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const summary = await getAnimalsSummary(ctx, req.params.farmId);
      res.json(summary);
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

animalsRouter.get(
  '/org/farms/:farmId/animals',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { farmId } = req.params;

      const page = req.query.page ? Number(req.query.page as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit as string) : undefined;
      const search = req.query.search as string | undefined;
      const sex = req.query.sex as string | undefined;
      const category = req.query.category as string | undefined;
      const breedId = req.query.breedId as string | undefined;
      const origin = req.query.origin as string | undefined;

      const result = await listAnimals(ctx, farmId, {
        page,
        limit,
        search,
        sex,
        category,
        breedId,
        origin,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

animalsRouter.get(
  '/org/farms/:farmId/animals/:animalId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const animal = await getAnimal(ctx, req.params.farmId, req.params.animalId);
      res.json(animal);
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

animalsRouter.patch(
  '/org/farms/:farmId/animals/:animalId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { farmId, animalId } = req.params;

      const animal = await updateAnimal(ctx, farmId, animalId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_ANIMAL',
        targetType: 'animal',
        targetId: animalId,
        metadata: { farmId },
        ipAddress: getClientIp(req),
        farmId,
        organizationId: ctx.organizationId,
      });

      res.json(animal);
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

animalsRouter.delete(
  '/org/farms/:farmId/animals/:animalId',
  authenticate,
  checkPermission('animals:delete'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { farmId, animalId } = req.params;

      await softDeleteAnimal(ctx, farmId, animalId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_ANIMAL',
        targetType: 'animal',
        targetId: animalId,
        metadata: { farmId },
        ipAddress: getClientIp(req),
        farmId,
        organizationId: ctx.organizationId,
      });

      res.status(204).send();
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
