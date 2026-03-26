// ─── Payroll Rubricas Routes ──────────────────────────────────────────

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { payrollRubricasService, PayrollRubricaError } from './payroll-rubricas.service';
import type { RubricaListQuery } from './payroll-rubricas.types';
import type { RubricaType } from '@prisma/client';

export const payrollRubricasRouter = Router();

const base = '/org/:orgId/payroll-rubricas';

// ─── Helpers ──────────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof PayrollRubricaError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/payroll-rubricas ────────────────────────────────

payrollRubricasRouter.get(
  base,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const userId = req.user?.userId ?? 'system';

      // Auto-seed system rubricas on first access
      const hasRubricas = await payrollRubricasService.hasRubricas(orgId);
      if (!hasRubricas) {
        await payrollRubricasService.seedSystemRubricas(orgId, userId);
      }

      const query: RubricaListQuery = {
        rubricaType: req.query.rubricaType as RubricaType | undefined,
        isActive:
          req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      };

      const result = await payrollRubricasService.list(orgId, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-rubricas/:id ────────────────────────────

payrollRubricasRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const rubrica = await payrollRubricasService.getById(orgId, id);
      res.json(rubrica);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/payroll-rubricas ───────────────────────────────

payrollRubricasRouter.post(
  base,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const userId = req.user?.userId ?? 'system';
      const rubrica = await payrollRubricasService.create(orgId, req.body, userId);
      res.status(201).json(rubrica);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /org/:orgId/payroll-rubricas/:id ────────────────────────────

payrollRubricasRouter.put(
  `${base}/:id`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const rubrica = await payrollRubricasService.update(orgId, id, req.body);
      res.json(rubrica);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/payroll-rubricas/:id/deactivate ───────────────

payrollRubricasRouter.patch(
  `${base}/:id/deactivate`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const rubrica = await payrollRubricasService.deactivate(orgId, id);
      res.json(rubrica);
    } catch (err) {
      handleError(err, res);
    }
  },
);
