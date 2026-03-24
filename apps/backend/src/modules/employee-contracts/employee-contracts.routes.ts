import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { EmployeeContractError } from './employee-contracts.types';
import {
  createContract,
  listContracts,
  getContract,
  updateContract,
  createAmendment,
  generateContractPdf,
} from './employee-contracts.service';

export const employeeContractsRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new EmployeeContractError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(
  err: unknown,
  res: import('express').Response,
): void {
  if (err instanceof EmployeeContractError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// GET /org/:orgId/employee-contracts — list contracts
employeeContractsRouter.get(
  '/org/:orgId/employee-contracts',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const employeeId = req.query.employeeId as string | undefined;
      const contractType = req.query.contractType as string | undefined;
      const isActiveRaw = req.query.isActive as string | undefined;
      const isActive =
        isActiveRaw === 'true' ? true : isActiveRaw === 'false' ? false : undefined;
      const page = req.query.page ? Number(req.query.page as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit as string) : undefined;

      const result = await listContracts(ctx, { employeeId, contractType, isActive, page, limit });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/employee-contracts — create contract
employeeContractsRouter.post(
  '/org/:orgId/employee-contracts',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const contract = await createContract(ctx, req.body);
      res.status(201).json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/employee-contracts/:id — get contract detail
employeeContractsRouter.get(
  '/org/:orgId/employee-contracts/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const contract = await getContract(ctx, req.params.id as string);
      res.json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PUT /org/:orgId/employee-contracts/:id — update non-critical fields
employeeContractsRouter.put(
  '/org/:orgId/employee-contracts/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const contract = await updateContract(ctx, req.params.id as string, req.body);
      res.json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/employee-contracts/:id/amendments — create amendment
employeeContractsRouter.post(
  '/org/:orgId/employee-contracts/:id/amendments',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { description, effectiveAt, changes } = req.body;
      if (!description || !effectiveAt || !changes) {
        res.status(400).json({ error: 'description, effectiveAt e changes são obrigatórios' });
        return;
      }
      const contract = await createAmendment(ctx, req.params.id as string, {
        description,
        effectiveAt,
        changes,
      });
      res.status(201).json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/employee-contracts/:id/pdf — generate PDF
employeeContractsRouter.get(
  '/org/:orgId/employee-contracts/:id/pdf',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const buffer = await generateContractPdf(ctx, req.params.id as string);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="contrato-${req.params.id as string}.pdf"`,
      );
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);
