import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { QuotationError } from './quotations.types';
import {
  createQuotation,
  listQuotations,
  getQuotationById,
  getComparativeMap,
  registerProposal,
  approveQuotation,
  transitionQuotation,
  deleteQuotation,
} from './quotations.service';

export const quotationsRouter = Router();

const base = '/org/quotations';

// ─── Multer setup ─────────────────────────────────────────────────────

const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new QuotationError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof QuotationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/quotations ───────────────────────────────────────────────

quotationsRouter.get(base, authenticate, checkPermission('purchases:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await listQuotations(ctx, req.query as never);
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── POST /org/quotations ──────────────────────────────────────────────

quotationsRouter.post(base, authenticate, checkPermission('purchases:manage'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const quotation = await createQuotation(ctx, req.body);
    res.status(201).json(quotation);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET /org/quotations/:id/comparative ──────────────────────────────
// CRITICAL: Register BEFORE /:id to prevent Express matching "comparative" as an ID

quotationsRouter.get(
  `${base}/:id/comparative`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getComparativeMap(ctx, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/quotations/:id ───────────────────────────────────────────

quotationsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const quotation = await getQuotationById(ctx, req.params.id);
      res.status(200).json(quotation);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/quotations/:id/transition ─────────────────────────────

quotationsRouter.patch(
  `${base}/:id/transition`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { status } = req.body as { status: string };
      if (!status) {
        res.status(400).json({ error: 'Campo status e obrigatorio.' });
        return;
      }
      const quotation = await transitionQuotation(ctx, req.params.id, status);
      res.status(200).json(quotation);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/quotations/:id/suppliers/:qsId/proposal ────────────────

quotationsRouter.post(
  `${base}/:id/suppliers/:qsId/proposal`,
  authenticate,
  checkPermission('purchases:manage'),
  upload.single('file'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const file = req.file ? { url: req.file.path, name: req.file.originalname } : undefined;
      const quotation = await registerProposal(ctx, req.params.id, req.params.qsId, req.body, file);
      res.status(200).json(quotation);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/quotations/:id/approve ────────────────────────────────

quotationsRouter.patch(
  `${base}/:id/approve`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await approveQuotation(ctx, req.params.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/quotations/:id ────────────────────────────────────────

quotationsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteQuotation(ctx, req.params.id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
