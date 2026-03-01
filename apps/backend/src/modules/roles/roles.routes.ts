import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import { ALL_MODULES, ALL_ACTIONS, DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';
import { getUserPermissions } from '../../shared/rbac/rbac.service';
import {
  createCustomRole,
  listCustomRoles,
  getCustomRole,
  updateCustomRole,
  deleteCustomRole,
} from './roles.service';
import { RoleError } from './roles.types';

export const rolesRouter = Router();

const orgAdminOnly = [authenticate, checkPermission('settings:update')];

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

// POST /org/roles — Create custom role
rolesRouter.post('/org/roles', ...orgAdminOnly, async (req, res) => {
  try {
    const { name, baseRole, description, overrides } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nome é obrigatório' });
      return;
    }

    if (!baseRole) {
      res.status(400).json({ error: 'Papel base é obrigatório' });
      return;
    }

    const orgId = req.user!.organizationId;
    const role = await createCustomRole(orgId, { name, baseRole, description, overrides });

    void logAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_CUSTOM_ROLE',
      targetType: 'custom_role',
      targetId: role.id,
      metadata: { name, baseRole },
      ipAddress: getClientIp(req),
      organizationId: orgId,
    });

    res.status(201).json(role);
  } catch (err) {
    if (err instanceof RoleError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /org/roles — List custom roles
rolesRouter.get('/org/roles', ...orgAdminOnly, async (req, res) => {
  try {
    const orgId = req.user!.organizationId;
    const roles = await listCustomRoles(orgId);
    res.json(roles);
  } catch (err) {
    if (err instanceof RoleError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /org/roles/:roleId — Get custom role detail
rolesRouter.get('/org/roles/:roleId', ...orgAdminOnly, async (req, res) => {
  try {
    const orgId = req.user!.organizationId;
    const role = await getCustomRole(orgId, req.params.roleId as string);
    res.json(role);
  } catch (err) {
    if (err instanceof RoleError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /org/roles/:roleId — Update custom role
rolesRouter.patch('/org/roles/:roleId', ...orgAdminOnly, async (req, res) => {
  try {
    const orgId = req.user!.organizationId;
    const { name, description, permissions } = req.body;
    const role = await updateCustomRole(orgId, req.params.roleId as string, {
      name,
      description,
      permissions,
    });

    void logAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_CUSTOM_ROLE',
      targetType: 'custom_role',
      targetId: req.params.roleId as string,
      metadata: { name, description },
      ipAddress: getClientIp(req),
      organizationId: orgId,
    });

    res.json(role);
  } catch (err) {
    if (err instanceof RoleError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /org/roles/:roleId — Soft-delete custom role
rolesRouter.delete('/org/roles/:roleId', ...orgAdminOnly, async (req, res) => {
  try {
    const orgId = req.user!.organizationId;
    const result = await deleteCustomRole(orgId, req.params.roleId as string);

    void logAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE_CUSTOM_ROLE',
      targetType: 'custom_role',
      targetId: req.params.roleId as string,
      metadata: {},
      ipAddress: getClientIp(req),
      organizationId: orgId,
    });

    res.json(result);
  } catch (err) {
    if (err instanceof RoleError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ─── Permission Matrix Endpoints ────────────────────────────────

// GET /org/permissions/matrix — Default permission matrix + custom roles
rolesRouter.get('/org/permissions/matrix', ...orgAdminOnly, async (req, res) => {
  try {
    const orgId = req.user!.organizationId;
    const customRoles = await listCustomRoles(orgId);

    const matrix = {
      modules: ALL_MODULES,
      actions: ALL_ACTIONS,
      defaults: Object.fromEntries(
        Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, perms]) => [
          role,
          perms.reduce(
            (acc, p) => {
              const [mod, action] = p.split(':');
              if (!acc[mod]) acc[mod] = {};
              acc[mod][action] = true;
              return acc;
            },
            {} as Record<string, Record<string, boolean>>,
          ),
        ]),
      ),
      customRoles: customRoles.map((cr) => ({
        id: cr.id,
        name: cr.name,
        baseRole: cr.baseRole,
        permissions: (
          cr.permissions as { module: string; action: string; allowed: boolean }[]
        ).reduce(
          (acc, p) => {
            if (!acc[p.module]) acc[p.module] = {};
            acc[p.module][p.action] = p.allowed;
            return acc;
          },
          {} as Record<string, Record<string, boolean>>,
        ),
      })),
    };

    res.json(matrix);
  } catch {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /org/permissions/me — Resolved permissions for current user
rolesRouter.get('/org/permissions/me', authenticate, async (req, res) => {
  try {
    const permissions = await getUserPermissions(req.user!.userId);
    res.json({ permissions });
  } catch {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
