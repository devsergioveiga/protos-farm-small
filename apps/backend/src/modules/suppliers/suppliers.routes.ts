import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { SupplierError } from './suppliers.types';
import {
  createSupplier,
  getSupplierById,
  listSuppliers,
  updateSupplier,
  deleteSupplier,
  importSuppliersPreview,
  importSuppliersExecute,
  getImportTemplate,
  exportSuppliersCsv,
  exportSuppliersPdf,
  createRating,
  listRatings,
  getTop3ByCategory,
  getPerformanceReport,
} from './suppliers.service';

export const suppliersRouter = Router();

const base = '/org/suppliers';

// ─── Multer setup ────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use CSV (.csv) ou Excel (.xlsx).'));
    }
  },
});

// ─── Helpers ────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new SupplierError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof SupplierError) {
    res.status(err.statusCode).json({ error: err.message, ...err.data });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── Import routes (BEFORE /:id to avoid Express matching "import" as ID) ───

// GET /org/suppliers/import/template
suppliersRouter.get(
  `${base}/import/template`,
  authenticate,
  checkPermission('purchases:read'),
  (_req, res) => {
    const csv = getImportTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fornecedores-template.csv"');
    res.send(csv);
  },
);

// POST /org/suppliers/import/preview
suppliersRouter.post(
  `${base}/import/preview`,
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
      const result = await importSuppliersPreview(ctx, req.file.buffer, req.file.mimetype);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/suppliers/import/execute
suppliersRouter.post(
  `${base}/import/execute`,
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
      const result = await importSuppliersExecute(
        ctx,
        req.file.buffer,
        req.file.mimetype,
        req.user!.userId,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Export routes (BEFORE /:id) ─────────────────────────────────────

// GET /org/suppliers/export/csv
suppliersRouter.get(
  `${base}/export/csv`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportSuppliersCsv(ctx, req.query as never);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="fornecedores.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/suppliers/export/pdf
suppliersRouter.get(
  `${base}/export/pdf`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      // Use org name from query or fallback
      const orgName = (req.query.orgName as string) ?? 'Organização';
      const pdf = await exportSuppliersPdf(ctx, req.query as never, orgName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="fornecedores.pdf"');
      res.send(pdf);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Top 3 route (BEFORE /:id) ────────────────────────────────────────

// GET /org/suppliers/top3?category=X
suppliersRouter.get(
  `${base}/top3`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const category = req.query.category as string;
      if (!category) {
        res.status(400).json({ error: 'Parâmetro "category" é obrigatório' });
        return;
      }
      const ctx = buildRlsContext(req);
      const result = await getTop3ByCategory(ctx, category);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Performance route (BEFORE /:id CRUD) ─────────────────────────────
// GET /org/suppliers/:id/performance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
suppliersRouter.get(
  `${base}/:id/performance`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const result = await getPerformanceReport(ctx, req.params.id as string, startDate, endDate);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CRUD routes ─────────────────────────────────────────────────────

// GET /org/suppliers
suppliersRouter.get(base, authenticate, checkPermission('purchases:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await listSuppliers(ctx, req.query as never);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// POST /org/suppliers
suppliersRouter.post(base, authenticate, checkPermission('purchases:manage'), async (req, res) => {
  try {
    const { name, type, document, categories } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nome é obrigatório' });
      return;
    }
    if (!type) {
      res.status(400).json({ error: 'Tipo é obrigatório' });
      return;
    }
    if (!document) {
      res.status(400).json({ error: 'Documento é obrigatório' });
      return;
    }
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      res.status(400).json({ error: 'Pelo menos uma categoria é obrigatória' });
      return;
    }

    const ctx = buildRlsContext(req);
    const supplier = await createSupplier(ctx, req.body, req.user!.userId);
    res.status(201).json(supplier);
  } catch (err) {
    handleError(err, res);
  }
});

// GET /org/suppliers/:id
suppliersRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const supplier = await getSupplierById(ctx, req.params.id as string);
      res.json(supplier);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/suppliers/:id
suppliersRouter.patch(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const supplier = await updateSupplier(ctx, req.params.id as string, req.body);
      res.json(supplier);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/suppliers/:id
suppliersRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteSupplier(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Ratings routes ──────────────────────────────────────────────────

// POST /org/suppliers/:id/ratings
suppliersRouter.post(
  `${base}/:id/ratings`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const rating = await createRating(ctx, req.params.id as string, req.body, req.user!.userId);
      res.status(201).json(rating);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/suppliers/:id/ratings
suppliersRouter.get(
  `${base}/:id/ratings`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const ratings = await listRatings(ctx, req.params.id as string);
      res.json(ratings);
    } catch (err) {
      handleError(err, res);
    }
  },
);
