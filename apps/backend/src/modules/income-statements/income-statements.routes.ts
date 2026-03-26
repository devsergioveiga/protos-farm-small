// ─── Income Statements Routes ─────────────────────────────────────────────────
// 5 endpoints: generate, list, rais-consistency (BEFORE /:id), download, send.
// NOTE: /rais-consistency registered BEFORE /:id to prevent Express 5 route shadowing.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { incomeStatementsService } from './income-statements.service';
import { IncomeStatementError } from './income-statements.types';

export const incomeStatementsRouter = Router();

const base = '/org/:orgId/income-statements';

// ─── Error handler ────────────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof IncomeStatementError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /generate — generate statements ─────────────────────────────────────

incomeStatementsRouter.post(
  `${base}/generate`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const userId = req.user?.userId ?? 'system';
      const statements = await incomeStatementsService.generateStatements(
        orgId,
        req.body,
        userId,
      );
      res.status(201).json(statements);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /rais-consistency — RAIS consistency report ─────────────────────────
// MUST be registered BEFORE /:id to prevent Express 5 route shadowing

incomeStatementsRouter.get(
  `${base}/rais-consistency`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const yearBase = parseInt(req.query.yearBase as string, 10);
      if (!yearBase || isNaN(yearBase)) {
        res.status(400).json({ error: 'yearBase obrigatorio' });
        return;
      }
      const result = await incomeStatementsService.getRaisConsistency(orgId, yearBase);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /send — batch send by email ────────────────────────────────────────

incomeStatementsRouter.post(
  `${base}/send`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const userId = req.user?.userId ?? 'system';
      const result = await incomeStatementsService.sendStatements(orgId, req.body, userId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET / — list statements ──────────────────────────────────────────────────

incomeStatementsRouter.get(
  base,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const result = await incomeStatementsService.listStatements(orgId, {
        yearBase: req.query.yearBase ? parseInt(req.query.yearBase as string, 10) : undefined,
        employeeId: req.query.employeeId as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /:id/download — download PDF ────────────────────────────────────────

incomeStatementsRouter.get(
  `${base}/:id/download`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const { buffer, filename } = await incomeStatementsService.downloadStatement(orgId, id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);
