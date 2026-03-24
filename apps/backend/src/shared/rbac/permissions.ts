import { UserRole } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────

export type PermissionModule =
  | 'organizations'
  | 'users'
  | 'farms'
  | 'producers'
  | 'animals'
  | 'operations'
  | 'financial'
  | 'reports'
  | 'settings'
  | 'reconciliation'
  | 'purchases'
  | 'assets'
  | 'depreciation'
  | 'maintenance-plans'
  | 'work-orders'
  | 'maintenance-provisions'
  | 'spare-parts'
  | 'employees';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'close';

export type Permission = `${PermissionModule}:${PermissionAction}`;

// ─── Constants ──────────────────────────────────────────────────────

export const ALL_MODULES: PermissionModule[] = [
  'organizations',
  'users',
  'farms',
  'producers',
  'animals',
  'operations',
  'financial',
  'reports',
  'settings',
  'reconciliation',
  'purchases',
  'assets',
  'depreciation',
  'maintenance-plans',
  'work-orders',
  'maintenance-provisions',
  'spare-parts',
  'employees',
];

export const ALL_ACTIONS: PermissionAction[] = [
  'create',
  'read',
  'update',
  'delete',
  'manage',
  'close',
];

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
    ...p('farms', 'create', 'read', 'update'),
    ...modulePermissions('producers'),
    ...p('animals', 'create', 'read', 'update'),
    ...p('users', 'read'),
    ...modulePermissions('operations'),
    ...modulePermissions('purchases'),
    ...modulePermissions('assets'),
    ...modulePermissions('depreciation'),
    ...modulePermissions('maintenance-plans'),
    ...modulePermissions('work-orders'),
    ...modulePermissions('maintenance-provisions'),
    ...modulePermissions('spare-parts'),
    ...modulePermissions('employees'),
    ...p('reports', 'read'),
    ...p('settings', 'read'),
    ...p('reconciliation', 'manage'),
  ],

  AGRONOMIST: [
    ...p('farms', 'read'),
    ...p('producers', 'read'),
    ...p('animals', 'read'),
    ...p('operations', 'create', 'read', 'update'),
    ...p('purchases', 'read'),
    ...p('reports', 'read'),
  ],

  FINANCIAL: [
    ...modulePermissions('financial'),
    ...p('farms', 'read'),
    ...p('producers', 'read'),
    ...p('purchases', 'read'),
    ...p('assets', 'read'),
    ...p('depreciation', 'read', 'update'),
    ...p('maintenance-plans', 'read'),
    ...p('work-orders', 'read', 'update', 'close'),
    ...p('maintenance-provisions', 'read', 'create', 'update'),
    ...p('spare-parts', 'read'),
    ...p('employees', 'read'),
    ...p('reports', 'read'),
    ...p('reconciliation', 'manage'),
  ],

  OPERATOR: [
    ...p('farms', 'read'),
    ...p('producers', 'read'),
    ...p('animals', 'create', 'read'),
    ...p('operations', 'create', 'read'),
    ...p('assets', 'read', 'update'),
    ...p('depreciation', 'read'),
    ...p('maintenance-plans', 'read'),
    ...p('work-orders', 'read', 'create'),
    ...p('maintenance-provisions', 'read'),
    ...p('spare-parts', 'read'),
  ],

  COWBOY: [
    ...p('farms', 'read'),
    ...p('animals', 'create', 'read'),
    ...p('operations', 'create', 'read'),
  ],

  CONSULTANT: [
    ...p('farms', 'read'),
    ...p('producers', 'read'),
    ...p('animals', 'read'),
    ...p('operations', 'read'),
    ...p('purchases', 'read'),
    ...p('reports', 'read'),
  ],
};
