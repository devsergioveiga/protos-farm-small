import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { PurchaseRequestError } from './purchase-requests.types';
import {
  createPurchaseRequest,
  getPurchaseRequestById,
  listPurchaseRequests,
  updatePurchaseRequest,
  deletePurchaseRequest,
} from './purchase-requests.service';
import { prisma } from '../../database/prisma';

export const purchaseRequestsRouter = Router();

const base = '/org/purchase-requests';

// ─── Multer setup ─────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orgId = (req.user?.organizationId as string) ?? 'unknown';
    const rcId = (req.params.id as string) ?? 'unknown';
    const dir = path.join('uploads', 'purchase-requests', orgId, rcId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PurchaseRequestError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof PurchaseRequestError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/purchase-requests ──────────────────────────────────────

purchaseRequestsRouter.post(
  base,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const rc = await createPurchaseRequest(ctx, req.body);
      res.status(201).json(rc);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/purchase-requests ───────────────────────────────────────

purchaseRequestsRouter.get(
  base,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        farmId: req.query.farmId as string | undefined,
        urgency: req.query.urgency as string | undefined,
        createdBy: req.query.createdBy as string | undefined,
      };
      const result = await listPurchaseRequests(ctx, query as never);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/purchase-requests/:id ───────────────────────────────────

purchaseRequestsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const rc = await getPurchaseRequestById(ctx, req.params.id as string);
      res.json(rc);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /org/purchase-requests/:id ───────────────────────────────────

purchaseRequestsRouter.put(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const rc = await updatePurchaseRequest(ctx, req.params.id as string, req.body);
      res.json(rc);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/purchase-requests/:id ────────────────────────────────

purchaseRequestsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deletePurchaseRequest(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/purchase-requests/:id/attachments ──────────────────────

purchaseRequestsRouter.post(
  `${base}/:id/attachments`,
  authenticate,
  checkPermission('purchases:manage'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo é obrigatório' });
        return;
      }

      const ctx = buildRlsContext(req);
      const rcId = req.params.id as string;

      // Verify RC exists and belongs to org
      await getPurchaseRequestById(ctx, rcId);

      const attachment = await prisma.purchaseRequestAttachment.create({
        data: {
          purchaseRequestId: rcId,
          fileName: req.file.originalname,
          filePath: req.file.path,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          uploadedBy: ctx.userId,
        },
      });

      res.status(201).json(attachment);
    } catch (err) {
      handleError(err, res);
    }
  },
);
