import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import {
  createOrgUser,
  listOrgUsers,
  getOrgUser,
  updateOrgUser,
  toggleOrgUserStatus,
  resetOrgUserPasswordByAdmin,
  getOrgUserLimit,
  resendInvite,
  generateInviteLink,
} from './org-users.service';
import { OrgUserError, ASSIGNABLE_ROLES } from './org-users.types';

export const orgUsersRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  return { organizationId: req.user!.organizationId };
}

// POST /org/users — CA1
orgUsersRouter.post(
  '/org/users',
  authenticate,
  checkPermission('users:create'),
  async (req, res) => {
    try {
      const { name, email, phone, role, farmIds } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Nome é obrigatório' });
        return;
      }

      if (!email) {
        res.status(400).json({ error: 'Email é obrigatório' });
        return;
      }

      if (!role) {
        res.status(400).json({ error: 'Role é obrigatória' });
        return;
      }

      if (!ASSIGNABLE_ROLES.includes(role)) {
        res.status(400).json({
          error: `Role inválida. Roles permitidas: ${ASSIGNABLE_ROLES.join(', ')}`,
        });
        return;
      }

      const ctx = buildRlsContext(req);
      const user = await createOrgUser(ctx, { name, email, phone, role, farmIds });

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_ORG_USER',
        targetType: 'user',
        targetId: user.id,
        metadata: { email, role, farmIds },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(user);
    } catch (err) {
      if (err instanceof OrgUserError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// GET /org/users/limit — CA5 (MUST be before /:userId)
orgUsersRouter.get(
  '/org/users/limit',
  authenticate,
  checkPermission('users:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getOrgUserLimit(ctx);
      res.json(result);
    } catch (err) {
      if (err instanceof OrgUserError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// GET /org/users — CA2
orgUsersRouter.get('/org/users', authenticate, checkPermission('users:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const page = req.query.page ? Number(req.query.page as string) : undefined;
    const limit = req.query.limit ? Number(req.query.limit as string) : undefined;
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;
    const farmId = req.query.farmId as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await listOrgUsers(ctx, { page, limit, search, role, farmId, status });
    res.json(result);
  } catch (err) {
    if (err instanceof OrgUserError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /org/users/:userId — CA2
orgUsersRouter.get(
  '/org/users/:userId',
  authenticate,
  checkPermission('users:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const user = await getOrgUser(ctx, req.params.userId as string);
      res.json(user);
    } catch (err) {
      if (err instanceof OrgUserError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// PATCH /org/users/:userId — CA3
orgUsersRouter.patch(
  '/org/users/:userId',
  authenticate,
  checkPermission('users:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const actorId = req.user!.userId;
      const { name, phone, role, farmIds } = req.body;

      const user = await updateOrgUser(ctx, req.params.userId as string, actorId, {
        name,
        phone,
        role,
        farmIds,
      });

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_ORG_USER',
        targetType: 'user',
        targetId: req.params.userId as string,
        metadata: { name, phone, role, farmIds },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(user);
    } catch (err) {
      if (err instanceof OrgUserError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// PATCH /org/users/:userId/status — CA4
orgUsersRouter.patch(
  '/org/users/:userId/status',
  authenticate,
  checkPermission('users:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const actorId = req.user!.userId;
      const { status } = req.body;

      if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
        res.status(400).json({ error: 'Status deve ser ACTIVE ou INACTIVE' });
        return;
      }

      const user = await toggleOrgUserStatus(ctx, req.params.userId as string, actorId, status);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_ORG_USER_STATUS',
        targetType: 'user',
        targetId: req.params.userId as string,
        metadata: { status },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(user);
    } catch (err) {
      if (err instanceof OrgUserError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// POST /org/users/:userId/reset-password — CA4
orgUsersRouter.post(
  '/org/users/:userId/reset-password',
  authenticate,
  checkPermission('users:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await resetOrgUserPasswordByAdmin(ctx, req.params.userId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RESET_ORG_USER_PASSWORD',
        targetType: 'user',
        targetId: req.params.userId as string,
        metadata: {},
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof OrgUserError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// POST /org/users/:userId/resend-invite — CA5
orgUsersRouter.post(
  '/org/users/:userId/resend-invite',
  authenticate,
  checkPermission('users:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await resendInvite(ctx, req.params.userId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RESEND_ORG_USER_INVITE',
        targetType: 'user',
        targetId: req.params.userId as string,
        metadata: {},
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof OrgUserError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// POST /org/users/:userId/invite-link — CA5
orgUsersRouter.post(
  '/org/users/:userId/invite-link',
  authenticate,
  checkPermission('users:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await generateInviteLink(ctx, req.params.userId as string);
      res.json(result);
    } catch (err) {
      if (err instanceof OrgUserError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
