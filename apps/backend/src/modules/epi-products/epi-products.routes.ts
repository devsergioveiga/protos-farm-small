import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { EpiProductError } from './epi-products.types';
import {
  createEpiProduct,
  updateEpiProduct,
  deleteEpiProduct,
  listEpiProducts,
  getEpiProduct,
  createPositionEpiRequirement,
  deletePositionEpiRequirement,
  listPositionEpiRequirements,
} from './epi-products.service';

const epiProductsRouter = Router();
export default epiProductsRouter;

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new EpiProductError('Acesso negado: usuário sem organização vinculada', 'UNAUTHORIZED');
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof EpiProductError) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'HAS_DELIVERIES' ? 409 : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  console.error('EpiProductError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /epi-products/position-requirements (BEFORE /:id) ──────────

epiProductsRouter.get(
  '/epi-products/position-requirements',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listPositionEpiRequirements(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /epi-products/position-requirements/:positionId ────────────

epiProductsRouter.get(
  '/epi-products/position-requirements/:positionId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const positionId = req.params.positionId as string;
      const result = await listPositionEpiRequirements(ctx, positionId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /epi-products/position-requirements ────────────────────────

epiProductsRouter.post(
  '/epi-products/position-requirements',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createPositionEpiRequirement(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /epi-products/position-requirements/:id ─────────────────

epiProductsRouter.delete(
  '/epi-products/position-requirements/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      await deletePositionEpiRequirement(ctx, id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /epi-products ───────────────────────────────────────────────

epiProductsRouter.get(
  '/epi-products',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        search: req.query.search as string | undefined,
        epiType: req.query.epiType as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listEpiProducts(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /epi-products ──────────────────────────────────────────────

epiProductsRouter.post(
  '/epi-products',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createEpiProduct(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /epi-products/:id ───────────────────────────────────────────

epiProductsRouter.get(
  '/epi-products/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const result = await getEpiProduct(ctx, id);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /epi-products/:id ───────────────────────────────────────────

epiProductsRouter.put(
  '/epi-products/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const result = await updateEpiProduct(ctx, id, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /epi-products/:id ────────────────────────────────────────

epiProductsRouter.delete(
  '/epi-products/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      await deleteEpiProduct(ctx, id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
