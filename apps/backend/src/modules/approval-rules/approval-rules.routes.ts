import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { ApprovalRuleError } from './approval-rules.types';
import {
  createApprovalRule,
  listApprovalRules,
  getApprovalRuleById,
  updateApprovalRule,
  deleteApprovalRule,
  reorderApprovalRules,
  createDelegation,
  listDelegations,
  deactivateDelegation,
} from './approval-rules.service';

export const approvalRulesRouter = Router();

const base = '/org/approval-rules';

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new ApprovalRuleError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof ApprovalRuleError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── Delegation routes (BEFORE /:id to avoid Express matching 'delegations' as ID) ───

// POST /org/approval-rules/delegations
approvalRulesRouter.post(
  `${base}/delegations`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const delegation = await createDelegation(ctx, req.body);
      res.status(201).json(delegation);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/approval-rules/delegations
approvalRulesRouter.get(
  `${base}/delegations`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const delegations = await listDelegations(ctx);
      res.json(delegations);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/approval-rules/delegations/:id/deactivate
approvalRulesRouter.patch(
  `${base}/delegations/:id/deactivate`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const delegation = await deactivateDelegation(ctx, req.params.id as string);
      res.json(delegation);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Reorder route (BEFORE /:id) ─────────────────────────────────────

// POST /org/approval-rules/reorder
approvalRulesRouter.post(
  `${base}/reorder`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        res.status(400).json({ error: 'orderedIds deve ser um array de IDs' });
        return;
      }
      const result = await reorderApprovalRules(ctx, orderedIds);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CRUD routes ─────────────────────────────────────────────────────

// POST /org/approval-rules
approvalRulesRouter.post(
  base,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const rule = await createApprovalRule(ctx, req.body);
      res.status(201).json(rule);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/approval-rules
approvalRulesRouter.get(base, authenticate, checkPermission('purchases:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const includeInactive = req.query.includeInactive === 'true';
    const rules = await listApprovalRules(ctx, { includeInactive });
    res.json(rules);
  } catch (err) {
    handleError(err, res);
  }
});

// GET /org/approval-rules/:id
approvalRulesRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const rule = await getApprovalRuleById(ctx, req.params.id as string);
      res.json(rule);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PUT /org/approval-rules/:id
approvalRulesRouter.put(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const rule = await updateApprovalRule(ctx, req.params.id as string, req.body);
      res.json(rule);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/approval-rules/:id
approvalRulesRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteApprovalRule(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
