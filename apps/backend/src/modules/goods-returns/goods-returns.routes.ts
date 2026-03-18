import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { GoodsReturnError } from './goods-returns.types';
import {
  createGoodsReturn,
  listGoodsReturns,
  getGoodsReturn,
  transitionGoodsReturn,
  uploadReturnPhoto,
  deleteGoodsReturn,
} from './goods-returns.service';

export const goodsReturnsRouter = Router();

const base = '/org/goods-returns';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new GoodsReturnError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof GoodsReturnError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── Multer (photo upload) ─────────────────────────────────────────────

const photoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orgId = req.user?.organizationId ?? 'unknown';
    const returnId = (req.params.id as string) ?? 'unknown';
    const dir = path.join('uploads', 'goods-returns', orgId, returnId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage: photoStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── GET /org/goods-returns ────────────────────────────────────────────

goodsReturnsRouter.get(base, authenticate, checkPermission('purchases:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const query = {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      status: req.query.status as string | undefined,
      supplierId: req.query.supplierId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      search: req.query.search as string | undefined,
    };
    const result = await listGoodsReturns(ctx, query);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── POST /org/goods-returns ───────────────────────────────────────────

goodsReturnsRouter.post(
  base,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const gr = await createGoodsReturn(ctx, req.body);
      res.status(201).json(gr);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/goods-returns/:id ────────────────────────────────────────

goodsReturnsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const gr = await getGoodsReturn(ctx, req.params.id as string);
      res.json(gr);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/goods-returns/:id/transition ──────────────────────────

goodsReturnsRouter.patch(
  `${base}/:id/transition`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const gr = await transitionGoodsReturn(ctx, req.params.id as string, req.body);
      res.json(gr);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/goods-returns/:id/items/:itemId/photo ──────────────────

goodsReturnsRouter.post(
  `${base}/:id/items/:itemId/photo`,
  authenticate,
  checkPermission('purchases:manage'),
  upload.single('photo'),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new GoodsReturnError('Arquivo de foto nao encontrado', 400);
      }
      const ctx = buildRlsContext(req);
      await uploadReturnPhoto(ctx, req.params.id as string, req.params.itemId as string, req.file);
      res.json({ success: true, photoUrl: req.file.path, photoFileName: req.file.originalname });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/goods-returns/:id ────────────────────────────────────

goodsReturnsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteGoodsReturn(ctx, req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      handleError(err, res);
    }
  },
);
