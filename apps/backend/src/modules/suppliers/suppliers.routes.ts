import { Router } from 'express';
import type { Request, Response } from 'express';
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
} from './suppliers.service';

export const suppliersRouter = Router();

const base = '/org/suppliers';

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
  res.status(500).json({ error: 'Erro interno do servidor' });
}

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
