import { prisma } from '../../database/prisma';
import {
  ASSIGNABLE_BASE_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  ALL_MODULES,
  ALL_ACTIONS,
  Permission,
} from '../../shared/rbac/permissions';
import { invalidatePermissionsCacheForRole } from '../../shared/rbac/rbac.service';
import { RoleError, CreateCustomRoleInput, UpdateCustomRoleInput } from './roles.types';

export async function createCustomRole(organizationId: string, input: CreateCustomRoleInput) {
  if (!ASSIGNABLE_BASE_ROLES.includes(input.baseRole)) {
    throw new RoleError(
      `Não é possível clonar o papel ${input.baseRole}. Papéis permitidos: ${ASSIGNABLE_BASE_ROLES.join(', ')}`,
      400,
    );
  }

  // Check uniqueness
  const existing = await prisma.customRole.findUnique({
    where: { name_organizationId: { name: input.name, organizationId } },
  });
  if (existing) {
    throw new RoleError('Já existe um papel customizado com esse nome nesta organização', 409);
  }

  // Get default permissions for the base role
  const basePermissions = DEFAULT_ROLE_PERMISSIONS[input.baseRole];

  // Build permission rows — start with all module×action combos
  const permissionRows = ALL_MODULES.flatMap((mod) =>
    ALL_ACTIONS.map((action) => {
      const perm = `${mod}:${action}` as Permission;
      let allowed = basePermissions.includes(perm);

      // Apply overrides (can only remove, not escalate)
      if (input.overrides) {
        const override = input.overrides.find((o) => o.permission === perm);
        if (override) {
          // Can only remove permissions that the base role has, not add new ones
          if (override.allowed && !basePermissions.includes(perm)) {
            // Attempted escalation — ignore this override
          } else {
            allowed = override.allowed;
          }
        }
      }

      return { module: mod, action, allowed };
    }),
  );

  const customRole = await prisma.customRole.create({
    data: {
      name: input.name,
      description: input.description,
      baseRole: input.baseRole,
      organizationId,
      permissions: {
        create: permissionRows,
      },
    },
    include: {
      permissions: true,
    },
  });

  return customRole;
}

export async function listCustomRoles(organizationId: string) {
  return prisma.customRole.findMany({
    where: { organizationId, isActive: true },
    include: {
      permissions: { where: { allowed: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getCustomRole(organizationId: string, roleId: string) {
  const role = await prisma.customRole.findFirst({
    where: { id: roleId, organizationId },
    include: {
      permissions: true,
      _count: { select: { users: true } },
    },
  });

  if (!role) {
    throw new RoleError('Papel customizado não encontrado', 404);
  }

  return role;
}

export async function updateCustomRole(
  organizationId: string,
  roleId: string,
  input: UpdateCustomRoleInput,
) {
  const role = await prisma.customRole.findFirst({
    where: { id: roleId, organizationId },
  });

  if (!role) {
    throw new RoleError('Papel customizado não encontrado', 404);
  }

  // Check name uniqueness if changing name
  if (input.name && input.name !== role.name) {
    const existing = await prisma.customRole.findUnique({
      where: { name_organizationId: { name: input.name, organizationId } },
    });
    if (existing) {
      throw new RoleError('Já existe um papel customizado com esse nome nesta organização', 409);
    }
  }

  // Update basic fields
  await prisma.customRole.update({
    where: { id: roleId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
    },
  });

  // Update permissions if provided
  if (input.permissions) {
    const basePermissions = DEFAULT_ROLE_PERMISSIONS[role.baseRole];

    for (const { permission, allowed } of input.permissions) {
      const [mod, action] = permission.split(':');

      // Prevent escalation beyond base role
      if (allowed && !basePermissions.includes(permission)) {
        continue;
      }

      await prisma.rolePermission.upsert({
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

    // Invalidate cache for all users with this custom role
    await invalidatePermissionsCacheForRole(roleId);
  }

  // Re-fetch with updated permissions
  return prisma.customRole.findUnique({
    where: { id: roleId },
    include: { permissions: true, _count: { select: { users: true } } },
  });
}

export async function deleteCustomRole(organizationId: string, roleId: string) {
  const role = await prisma.customRole.findFirst({
    where: { id: roleId, organizationId },
  });

  if (!role) {
    throw new RoleError('Papel customizado não encontrado', 404);
  }

  // Soft-delete: set isActive to false
  await prisma.customRole.update({
    where: { id: roleId },
    data: { isActive: false },
  });

  // Clear customRoleId from users — they fall back to default role permissions
  await prisma.user.updateMany({
    where: { customRoleId: roleId },
    data: { customRoleId: null },
  });

  // Invalidate cache for affected users
  await invalidatePermissionsCacheForRole(roleId);

  return { message: 'Papel customizado desativado com sucesso' };
}
