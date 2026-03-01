import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  ASSIGNABLE_BASE_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  ALL_MODULES,
  ALL_ACTIONS,
  Permission,
} from '../../shared/rbac/permissions';
import { invalidatePermissionsCacheForRole } from '../../shared/rbac/rbac.service';
import { RoleError, CreateCustomRoleInput, UpdateCustomRoleInput } from './roles.types';

export async function createCustomRole(ctx: RlsContext, input: CreateCustomRoleInput) {
  if (!ASSIGNABLE_BASE_ROLES.includes(input.baseRole)) {
    throw new RoleError(
      `Não é possível clonar o papel ${input.baseRole}. Papéis permitidos: ${ASSIGNABLE_BASE_ROLES.join(', ')}`,
      400,
    );
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.customRole.findUnique({
      where: { name_organizationId: { name: input.name, organizationId: ctx.organizationId } },
    });
    if (existing) {
      throw new RoleError('Já existe um papel customizado com esse nome nesta organização', 409);
    }

    const basePermissions = DEFAULT_ROLE_PERMISSIONS[input.baseRole];

    const permissionRows = ALL_MODULES.flatMap((mod) =>
      ALL_ACTIONS.map((action) => {
        const perm = `${mod}:${action}` as Permission;
        let allowed = basePermissions.includes(perm);

        if (input.overrides) {
          const override = input.overrides.find((o) => o.permission === perm);
          if (override) {
            if (override.allowed && !basePermissions.includes(perm)) {
              // Attempted escalation — ignore
            } else {
              allowed = override.allowed;
            }
          }
        }

        return { module: mod, action, allowed };
      }),
    );

    const customRole = await tx.customRole.create({
      data: {
        name: input.name,
        description: input.description,
        baseRole: input.baseRole,
        organizationId: ctx.organizationId,
        permissions: {
          create: permissionRows,
        },
      },
      include: {
        permissions: true,
      },
    });

    return customRole;
  });
}

export async function listCustomRoles(ctx: RlsContext) {
  return withRlsContext(ctx, async (tx) => {
    return tx.customRole.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      include: {
        permissions: { where: { allowed: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  });
}

export async function getCustomRole(ctx: RlsContext, roleId: string) {
  return withRlsContext(ctx, async (tx) => {
    const role = await tx.customRole.findFirst({
      where: { id: roleId, organizationId: ctx.organizationId },
      include: {
        permissions: true,
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      throw new RoleError('Papel customizado não encontrado', 404);
    }

    return role;
  });
}

export async function updateCustomRole(
  ctx: RlsContext,
  roleId: string,
  input: UpdateCustomRoleInput,
) {
  return withRlsContext(ctx, async (tx) => {
    const role = await tx.customRole.findFirst({
      where: { id: roleId, organizationId: ctx.organizationId },
    });

    if (!role) {
      throw new RoleError('Papel customizado não encontrado', 404);
    }

    if (input.name && input.name !== role.name) {
      const existing = await tx.customRole.findUnique({
        where: { name_organizationId: { name: input.name, organizationId: ctx.organizationId } },
      });
      if (existing) {
        throw new RoleError('Já existe um papel customizado com esse nome nesta organização', 409);
      }
    }

    await tx.customRole.update({
      where: { id: roleId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    if (input.permissions) {
      const basePermissions = DEFAULT_ROLE_PERMISSIONS[role.baseRole];

      for (const { permission, allowed } of input.permissions) {
        const [mod, action] = permission.split(':');

        if (allowed && !basePermissions.includes(permission)) {
          continue;
        }

        await tx.rolePermission.upsert({
          where: {
            customRoleId_module_action: {
              customRoleId: roleId,
              module: mod,
              action,
            },
          },
          create: { customRoleId: roleId, module: mod, action, allowed },
          update: { allowed },
        });
      }

      await invalidatePermissionsCacheForRole(roleId);
    }

    return tx.customRole.findUnique({
      where: { id: roleId },
      include: { permissions: true, _count: { select: { users: true } } },
    });
  });
}

export async function deleteCustomRole(ctx: RlsContext, roleId: string) {
  return withRlsContext(ctx, async (tx) => {
    const role = await tx.customRole.findFirst({
      where: { id: roleId, organizationId: ctx.organizationId },
    });

    if (!role) {
      throw new RoleError('Papel customizado não encontrado', 404);
    }

    await tx.customRole.update({
      where: { id: roleId },
      data: { isActive: false },
    });

    await tx.user.updateMany({
      where: { customRoleId: roleId },
      data: { customRoleId: null },
    });

    await invalidatePermissionsCacheForRole(roleId);

    return { message: 'Papel customizado desativado com sucesso' };
  });
}
