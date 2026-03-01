import { withRlsBypass } from '../../database/rls';
import { redis } from '../../database/redis';
import { DEFAULT_ROLE_PERMISSIONS, Permission, ROLE_HIERARCHY } from './permissions';

const CACHE_PREFIX = 'permissions:';
const CACHE_TTL = 300; // 5 minutes

export async function getUserPermissions(userId: string): Promise<Permission[]> {
  // Check cache first
  const cached = await redis.get(`${CACHE_PREFIX}${userId}`);
  if (cached) {
    return JSON.parse(cached) as Permission[];
  }

  const user = await withRlsBypass(async (tx) => {
    return tx.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        customRoleId: true,
        customRole: {
          select: {
            isActive: true,
            permissions: {
              select: { module: true, action: true, allowed: true },
            },
          },
        },
      },
    });
  });

  if (!user) {
    return [];
  }

  let permissions: Permission[];

  if (user.customRoleId && user.customRole?.isActive) {
    // Use custom role permissions
    permissions = user.customRole.permissions
      .filter((p) => p.allowed)
      .map((p) => `${p.module}:${p.action}` as Permission);
  } else {
    // Use default permissions for the base role
    permissions = DEFAULT_ROLE_PERMISSIONS[user.role] ?? [];
  }

  // Cache the resolved permissions
  await redis.set(`${CACHE_PREFIX}${userId}`, JSON.stringify(permissions), 'EX', CACHE_TTL);

  return permissions;
}

export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  const user = await withRlsBypass(async (tx) => {
    return tx.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
  });

  // SUPER_ADMIN bypasses all permission checks
  if (user && ROLE_HIERARCHY[user.role] >= 100) {
    return true;
  }

  const permissions = await getUserPermissions(userId);
  return permissions.includes(permission);
}

export async function invalidatePermissionsCache(userId: string): Promise<void> {
  await redis.del(`${CACHE_PREFIX}${userId}`);
}

export async function invalidatePermissionsCacheForRole(customRoleId: string): Promise<void> {
  const users = await withRlsBypass(async (tx) => {
    return tx.user.findMany({
      where: { customRoleId },
      select: { id: true },
    });
  });

  if (users.length > 0) {
    const keys = users.map((u) => `${CACHE_PREFIX}${u.id}`);
    await redis.del(...keys);
  }
}
