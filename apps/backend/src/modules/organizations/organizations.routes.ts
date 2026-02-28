import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { logAudit } from '../../shared/audit/audit.service';
import {
  createOrganization,
  listOrganizations,
  getOrganizationById,
  updateOrganizationStatus,
  updateOrganizationPlan,
  createOrgAdmin,
  resetOrgUserPassword,
  unlockOrgUser,
  OrgError,
} from './organizations.service';

export const organizationsRouter = Router();

const adminOnly = [authenticate, authorize('SUPER_ADMIN')];

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

// POST /admin/organizations
organizationsRouter.post('/admin/organizations', ...adminOnly, async (req, res) => {
  try {
    const { name, type, document, plan, maxUsers, maxFarms } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nome é obrigatório' });
      return;
    }

    if (!type || !['PF', 'PJ'].includes(type)) {
      res.status(400).json({ error: 'Tipo deve ser PF ou PJ' });
      return;
    }

    if (!document) {
      res.status(400).json({ error: 'Documento é obrigatório' });
      return;
    }

    const org = await createOrganization({ name, type, document, plan, maxUsers, maxFarms });

    void logAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_ORGANIZATION',
      targetType: 'organization',
      targetId: org.id,
      metadata: { name, type, plan: plan ?? 'basic' },
      ipAddress: getClientIp(req),
    });

    res.status(201).json(org);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /admin/organizations
organizationsRouter.get('/admin/organizations', ...adminOnly, async (req, res) => {
  try {
    const page = req.query.page ? Number(req.query.page as string) : undefined;
    const limit = req.query.limit ? Number(req.query.limit as string) : undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const result = await listOrganizations({ page, limit, status, search });
    res.json(result);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /admin/organizations/:id
organizationsRouter.get('/admin/organizations/:id', ...adminOnly, async (req, res) => {
  try {
    const org = await getOrganizationById(req.params.id as string);
    res.json(org);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /admin/organizations/:id/status
organizationsRouter.patch('/admin/organizations/:id/status', ...adminOnly, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status é obrigatório' });
      return;
    }

    if (!['ACTIVE', 'SUSPENDED', 'CANCELLED'].includes(status)) {
      res.status(400).json({ error: 'Status deve ser ACTIVE, SUSPENDED ou CANCELLED' });
      return;
    }

    const org = await updateOrganizationStatus(req.params.id as string, status);

    void logAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_ORGANIZATION_STATUS',
      targetType: 'organization',
      targetId: req.params.id as string,
      metadata: { status },
      ipAddress: getClientIp(req),
    });

    res.json(org);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /admin/organizations/:id/plan
organizationsRouter.patch('/admin/organizations/:id/plan', ...adminOnly, async (req, res) => {
  try {
    const { plan, maxUsers, maxFarms } = req.body;

    if (!plan) {
      res.status(400).json({ error: 'Plano é obrigatório' });
      return;
    }

    const org = await updateOrganizationPlan(req.params.id as string, { plan, maxUsers, maxFarms });

    void logAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_ORGANIZATION_PLAN',
      targetType: 'organization',
      targetId: req.params.id as string,
      metadata: { plan, maxUsers, maxFarms },
      ipAddress: getClientIp(req),
    });

    res.json(org);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /admin/organizations/:id/users
organizationsRouter.post('/admin/organizations/:id/users', ...adminOnly, async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nome é obrigatório' });
      return;
    }

    if (!email) {
      res.status(400).json({ error: 'Email é obrigatório' });
      return;
    }

    const user = await createOrgAdmin(req.params.id as string, { name, email, phone });

    void logAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_ORG_ADMIN',
      targetType: 'user',
      targetId: user.id,
      metadata: { organizationId: req.params.id, email },
      ipAddress: getClientIp(req),
    });

    res.status(201).json(user);
  } catch (err) {
    if (err instanceof OrgError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /admin/organizations/:id/users/:userId/reset-password
organizationsRouter.post(
  '/admin/organizations/:id/users/:userId/reset-password',
  ...adminOnly,
  async (req, res) => {
    try {
      const result = await resetOrgUserPassword(
        req.params.id as string,
        req.params.userId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RESET_USER_PASSWORD',
        targetType: 'user',
        targetId: req.params.userId as string,
        metadata: { organizationId: req.params.id },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      if (err instanceof OrgError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// PATCH /admin/organizations/:id/users/:userId/unlock
organizationsRouter.patch(
  '/admin/organizations/:id/users/:userId/unlock',
  ...adminOnly,
  async (req, res) => {
    try {
      const user = await unlockOrgUser(req.params.id as string, req.params.userId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UNLOCK_USER',
        targetType: 'user',
        targetId: req.params.userId as string,
        metadata: { organizationId: req.params.id },
        ipAddress: getClientIp(req),
      });

      res.json(user);
    } catch (err) {
      if (err instanceof OrgError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
