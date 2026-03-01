import { UserRole } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────

export type PermissionModule =
  | 'organizations'
  | 'users'
  | 'farms'
  | 'operations'
  | 'financial'
  | 'reports'
  | 'settings';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export type Permission = `${PermissionModule}:${PermissionAction}`;

// ─── Constants ──────────────────────────────────────────────────────

export const ALL_MODULES: PermissionModule[] = [
  'organizations',
  'users',
  'farms',
  'operations',
  'financial',
  'reports',
  'settings',
];

export const ALL_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete'];

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  MANAGER: 70,
  AGRONOMIST: 50,
  FINANCIAL: 50,
  OPERATOR: 30,
  COWBOY: 20,
  CONSULTANT: 10,
};

/** Roles that an ADMIN can assign (cannot create SUPER_ADMIN or ADMIN) */
export const ASSIGNABLE_BASE_ROLES: UserRole[] = [
  'MANAGER',
  'AGRONOMIST',
  'FINANCIAL',
  'OPERATOR',
  'COWBOY',
  'CONSULTANT',
];

// ─── Default Permission Matrix ──────────────────────────────────────

function allPermissions(): Permission[] {
  return ALL_MODULES.flatMap((m) => ALL_ACTIONS.map((a) => `${m}:${a}` as Permission));
}

function modulePermissions(mod: PermissionModule): Permission[] {
  return ALL_ACTIONS.map((a) => `${mod}:${a}` as Permission);
}

function p(mod: PermissionModule, ...actions: PermissionAction[]): Permission[] {
  return actions.map((a) => `${mod}:${a}` as Permission);
}

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: allPermissions(),

  ADMIN: allPermissions().filter(
    (perm) => perm !== 'organizations:create' && perm !== 'organizations:delete',
  ),

  MANAGER: [
    ...modulePermissions('farms'),
    ...p('users', 'read'),
    ...modulePermissions('operations'),
    ...p('reports', 'read'),
    ...p('settings', 'read'),
  ],

  AGRONOMIST: [
    ...p('farms', 'read'),
    ...p('operations', 'create', 'read', 'update'),
    ...p('reports', 'read'),
  ],

  FINANCIAL: [...modulePermissions('financial'), ...p('farms', 'read'), ...p('reports', 'read')],

  OPERATOR: [...p('farms', 'read'), ...p('operations', 'create', 'read')],

  COWBOY: [...p('farms', 'read'), ...p('operations', 'create', 'read')],

  CONSULTANT: [...p('farms', 'read'), ...p('operations', 'read'), ...p('reports', 'read')],
};
