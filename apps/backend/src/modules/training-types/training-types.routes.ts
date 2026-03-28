import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { TrainingTypeError } from './training-types.types';
import {
  seedNr31TrainingTypes,
  listTrainingTypes,
  getTrainingType,
  createTrainingType,
  updateTrainingType,
  deleteTrainingType,
  listPositionTrainingRequirements,
  createPositionTrainingRequirement,
  deletePositionTrainingRequirement,
} from './training-types.service';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new TrainingTypeError('Acesso negado: usuário sem organização vinculada', 'UNAUTHORIZED');
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof TrainingTypeError) {
    const statusCode =
      err.code === 'NOT_FOUND' || err.code === 'POSITION_NOT_FOUND'
        ? 404
        : err.code === 'SYSTEM_TYPE_READONLY'
          ? 400
          : err.code === 'HAS_RECORDS' || err.code === 'DUPLICATE_REQUIREMENT'
            ? 409
            : err.code === 'NAME_CONFLICT'
              ? 409
              : err.code === 'UNAUTHORIZED'
                ? 403
                : 400;
    res.status(statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /training-types/seed ────────────────────────────────────────
// Must be registered before /:id to avoid route collision

router.post(
  '/training-types/seed',
  authenticate,
  checkPermission('employees:manage'),
  async (_req: Request, res: Response) => {
    try {
      await seedNr31TrainingTypes();
      res.status(200).json({ message: 'Tipos de treinamento NR-31 inseridos com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /training-types/position-requirements ───────────────────────
// Must be registered before /:id to avoid route collision

router.get(
  '/training-types/position-requirements',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const positionId = req.query.positionId as string | undefined;
      const result = await listPositionTrainingRequirements(ctx, positionId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /training-types/position-requirements/:positionId ───────────

router.get(
  '/training-types/position-requirements/:positionId',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const positionId = req.params.positionId as string;
      const result = await listPositionTrainingRequirements(ctx, positionId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /training-types/position-requirements ───────────────────────

router.post(
  '/training-types/position-requirements',
  authenticate,
  checkPermission('employees:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createPositionTrainingRequirement(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /training-types/position-requirements/:id ────────────────

router.delete(
  '/training-types/position-requirements/:id',
  authenticate,
  checkPermission('employees:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      await deletePositionTrainingRequirement(ctx, id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /training-types ─────────────────────────────────────────────

router.get(
  '/training-types',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listTrainingTypes(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /training-types ─────────────────────────────────────────────

router.post(
  '/training-types',
  authenticate,
  checkPermission('employees:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createTrainingType(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /training-types/:id ──────────────────────────────────────────

router.get(
  '/training-types/:id',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const result = await getTrainingType(ctx, id);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /training-types/:id ──────────────────────────────────────────

router.put(
  '/training-types/:id',
  authenticate,
  checkPermission('employees:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const result = await updateTrainingType(ctx, id, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /training-types/:id ───────────────────────────────────────

router.delete(
  '/training-types/:id',
  authenticate,
  checkPermission('employees:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      await deleteTrainingType(ctx, id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default router;
