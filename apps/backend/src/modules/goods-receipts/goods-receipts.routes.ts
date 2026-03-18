import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { GoodsReceiptError } from './goods-receipts.types';
import {
  createGoodsReceipt,
  listGoodsReceipts,
  getGoodsReceiptById,
  transitionGoodsReceipt,
  listPendingDeliveries,
  updateGoodsReceiptDivergencePhoto,
  confirmGoodsReceipt,
} from './goods-receipts.service';

export const goodsReceiptsRouter = Router();

const base = '/org/goods-receipts';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new GoodsReceiptError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof GoodsReceiptError) {
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
    const grId = (req.params.id as string) ?? 'unknown';
    const dir = path.join('uploads', 'goods-receipts', orgId, grId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage: photoStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── GET /org/goods-receipts/pending (BEFORE /:id) ────────────────────

goodsReceiptsRouter.get(
  `${base}/pending`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listPendingDeliveries(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/goods-receipts ───────────────────────────────────────────

goodsReceiptsRouter.get(base, authenticate, checkPermission('purchases:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const query = {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      receivingType: req.query.receivingType as string | undefined,
      supplierId: req.query.supplierId as string | undefined,
      purchaseOrderId: req.query.purchaseOrderId as string | undefined,
    };
    const result = await listGoodsReceipts(ctx, query);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET /org/goods-receipts/:id ──────────────────────────────────────

goodsReceiptsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const gr = await getGoodsReceiptById(ctx, req.params.id as string);
      res.json(gr);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/goods-receipts ─────────────────────────────────────────

goodsReceiptsRouter.post(
  base,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const gr = await createGoodsReceipt(ctx, req.body);
      res.status(201).json(gr);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /org/goods-receipts/:id/confirm ──────────────────────────────

goodsReceiptsRouter.put(
  `${base}/:id/confirm`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const gr = await confirmGoodsReceipt(ctx, req.params.id as string);
      res.json(gr);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /org/goods-receipts/:id/transition ───────────────────────────

goodsReceiptsRouter.put(
  `${base}/:id/transition`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const gr = await transitionGoodsReceipt(ctx, req.params.id as string, req.body);
      res.json(gr);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/goods-receipts/:id/divergences/:divergenceId/photo ─────

goodsReceiptsRouter.post(
  `${base}/:id/divergences/:divergenceId/photo`,
  authenticate,
  checkPermission('purchases:manage'),
  upload.single('photo'),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new GoodsReceiptError('Arquivo de foto nao encontrado', 400);
      }
      const ctx = buildRlsContext(req);
      const photoUrl = req.file.path;
      const photoFileName = req.file.originalname;
      await updateGoodsReceiptDivergencePhoto(
        ctx,
        req.params.id as string,
        req.params.divergenceId as string,
        photoUrl,
        photoFileName,
      );
      res.json({ success: true, photoUrl, photoFileName });
    } catch (err) {
      handleError(err, res);
    }
  },
);
