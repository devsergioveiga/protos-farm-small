import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { AnimalError } from './animals.types';
import { ACCEPTED_ANIMAL_EXTENSIONS, MAX_ANIMAL_FILE_SIZE } from './animal-file-parser';
import {
  createAnimal,
  listAnimals,
  getAnimal,
  updateAnimal,
  softDeleteAnimal,
  getAnimalsSummary,
  exportAnimalsCsv,
  listBreeds,
  createBreed,
  deleteBreed,
  previewBulkImportAnimals,
  executeBulkImportAnimals,
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
      await deleteBreed(ctx, req.params.breedId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_BREED',
        targetType: 'breed',
        targetId: req.params.breedId as string,
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
      const farmId = req.params.farmId as string;
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

// ─── Multer config for animal file uploads ────────────────────────────

const animalUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_ANIMAL_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ((ACCEPTED_ANIMAL_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Formato não suportado. Extensões aceitas: ${ACCEPTED_ANIMAL_EXTENSIONS.join(', ')}`,
        ),
      );
    }
  },
});

function handleAnimalUpload(
  req: import('express').Request,
  res: import('express').Response,
): Promise<void> {
  return new Promise((resolve, reject) => {
    animalUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          res.status(400).json({
            error: err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo excede o limite de 5 MB' : err.message,
          });
        } else if (err instanceof Error) {
          res.status(400).json({ error: err.message });
        } else {
          reject(err);
        }
        resolve();
      } else {
        resolve();
      }
    });
  });
}

// ─── Bulk Import Endpoints (must be before :animalId) ─────────────────

animalsRouter.post(
  '/org/farms/:farmId/animals/bulk/preview',
  authenticate,
  checkPermission('animals:create'),
  checkFarmAccess(),
  async (req, res) => {
    await handleAnimalUpload(req, res);
    if (res.headersSent) return;
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo é obrigatório' });
        return;
      }

      const ctx = buildRlsContext(req);
      const result = await previewBulkImportAnimals(
        ctx,
        req.params.farmId as string,
        req.file.buffer,
        req.file.originalname,
      );

      res.json(result);
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

animalsRouter.post(
  '/org/farms/:farmId/animals/bulk',
  authenticate,
  checkPermission('animals:create'),
  checkFarmAccess(),
  async (req, res) => {
    await handleAnimalUpload(req, res);
    if (res.headersSent) return;
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo é obrigatório' });
        return;
      }

      let columnMapping = {};
      let selectedIndices: number[] = [];

      try {
        if (req.body.columnMapping) {
          columnMapping = JSON.parse(req.body.columnMapping as string);
        }
        if (req.body.selectedIndices) {
          selectedIndices = JSON.parse(req.body.selectedIndices as string);
        }
      } catch {
        res.status(400).json({ error: 'Formato inválido de columnMapping ou selectedIndices' });
        return;
      }

      if (!Array.isArray(selectedIndices) || selectedIndices.length === 0) {
        res.status(400).json({ error: 'selectedIndices deve ser um array não vazio' });
        return;
      }

      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await executeBulkImportAnimals(
        ctx,
        farmId,
        req.file.buffer,
        req.file.originalname,
        { columnMapping, selectedIndices },
        req.user!.userId,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_IMPORT_ANIMALS',
        targetType: 'farm',
        targetId: farmId,
        metadata: {
          filename: req.file.originalname,
          imported: result.imported,
          skipped: result.skipped,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof AnimalError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ error: err.message });
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
      const summary = await getAnimalsSummary(ctx, req.params.farmId as string);
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

function parseNumericParam(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (isNaN(n)) return NaN;
  return n;
}

animalsRouter.get(
  '/org/farms/:farmId/animals',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;

      const page = req.query.page ? Number(req.query.page as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit as string) : undefined;
      const search = req.query.search as string | undefined;
      const sex = req.query.sex as string | undefined;
      const category = req.query.category as string | undefined;
      const breedId = req.query.breedId as string | undefined;
      const origin = req.query.origin as string | undefined;
      const lotId = req.query.lotId as string | undefined;
      const locationId = req.query.locationId as string | undefined;
      const birthDateFrom = req.query.birthDateFrom as string | undefined;
      const birthDateTo = req.query.birthDateTo as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as string | undefined;

      const minWeightKg = parseNumericParam(req.query.minWeightKg);
      const maxWeightKg = parseNumericParam(req.query.maxWeightKg);
      const minAgeDays = parseNumericParam(req.query.minAgeDays);
      const maxAgeDays = parseNumericParam(req.query.maxAgeDays);

      const numericParams = { minWeightKg, maxWeightKg, minAgeDays, maxAgeDays };
      for (const [key, val] of Object.entries(numericParams)) {
        if (val !== undefined && isNaN(val)) {
          res.status(400).json({ error: `Parâmetro '${key}' deve ser numérico` });
          return;
        }
      }

      const result = await listAnimals(ctx, farmId, {
        page,
        limit,
        search,
        sex,
        category,
        breedId,
        origin,
        lotId,
        locationId,
        birthDateFrom,
        birthDateTo,
        minWeightKg,
        maxWeightKg,
        minAgeDays,
        maxAgeDays,
        sortBy: sortBy as import('./animals.types').AnimalSortField | undefined,
        sortOrder: sortOrder as 'asc' | 'desc' | undefined,
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

// Export must be before :animalId
animalsRouter.get(
  '/org/farms/:farmId/animals/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;

      const search = req.query.search as string | undefined;
      const sex = req.query.sex as string | undefined;
      const category = req.query.category as string | undefined;
      const breedId = req.query.breedId as string | undefined;
      const origin = req.query.origin as string | undefined;
      const lotId = req.query.lotId as string | undefined;
      const locationId = req.query.locationId as string | undefined;
      const birthDateFrom = req.query.birthDateFrom as string | undefined;
      const birthDateTo = req.query.birthDateTo as string | undefined;

      const minWeightKg = parseNumericParam(req.query.minWeightKg);
      const maxWeightKg = parseNumericParam(req.query.maxWeightKg);
      const minAgeDays = parseNumericParam(req.query.minAgeDays);
      const maxAgeDays = parseNumericParam(req.query.maxAgeDays);

      const numericParams = { minWeightKg, maxWeightKg, minAgeDays, maxAgeDays };
      for (const [key, val] of Object.entries(numericParams)) {
        if (val !== undefined && isNaN(val)) {
          res.status(400).json({ error: `Parâmetro '${key}' deve ser numérico` });
          return;
        }
      }

      const csv = await exportAnimalsCsv(ctx, farmId, {
        search,
        sex,
        category,
        breedId,
        origin,
        lotId,
        locationId,
        birthDateFrom,
        birthDateTo,
        minWeightKg,
        maxWeightKg,
        minAgeDays,
        maxAgeDays,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="animais-${farmId}.csv"`);
      res.send(csv);
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
      const animal = await getAnimal(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );
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
      const farmId = req.params.farmId as string;
      const animalId = req.params.animalId as string;

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
      const farmId = req.params.farmId as string;
      const animalId = req.params.animalId as string;

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
