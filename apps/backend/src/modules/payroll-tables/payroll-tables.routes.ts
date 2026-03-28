// ─── Payroll Legal Tables Routes ─────────────────────────────────────

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { payrollTablesService, PayrollTableError } from './payroll-tables.service';
import type { LegalTableQuery } from './payroll-tables.types';
import type { LegalTableType } from '@prisma/client';

export const payrollTablesRouter = Router();

const base = '/org/:orgId/payroll-tables';

// ─── Helpers ──────────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof PayrollTableError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/payroll-tables/effective ─────────────────────────
// Note: must be registered BEFORE /:id to avoid route conflict

payrollTablesRouter.get(
  `${base}/effective`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const tableType = req.query.tableType as LegalTableType | undefined;
      const competenceDateStr = req.query.competenceDate as string | undefined;

      if (!tableType) {
        res.status(400).json({ error: 'tableType é obrigatório' });
        return;
      }

      if (!competenceDateStr) {
        res.status(400).json({ error: 'competenceDate é obrigatório' });
        return;
      }

      const competenceDate = new Date(competenceDateStr);
      if (isNaN(competenceDate.getTime())) {
        res.status(400).json({ error: 'competenceDate inválido — use formato ISO (YYYY-MM-DD)' });
        return;
      }

      const table = await payrollTablesService.getEffective(orgId, tableType, competenceDate);

      if (!table) {
        res.status(404).json({
          error: `Nenhuma tabela ${tableType} encontrada para a data ${competenceDateStr}`,
        });
        return;
      }

      res.json(table);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-tables ──────────────────────────────────

payrollTablesRouter.get(
  base,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;

      const query: LegalTableQuery = {
        tableType: req.query.tableType as LegalTableType | undefined,
        effectiveAt: req.query.effectiveAt as string | undefined,
      };

      const tables = await payrollTablesService.list(orgId, query);
      res.json(tables);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-tables/:id ──────────────────────────────

payrollTablesRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const table = await payrollTablesService.getById(orgId, id);
      res.json(table);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/payroll-tables ─────────────────────────────────

payrollTablesRouter.post(
  base,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const userId = req.user?.userId ?? 'system';
      const table = await payrollTablesService.create(orgId, req.body, userId);
      res.status(201).json(table);
    } catch (err) {
      handleError(err, res);
    }
  },
);
