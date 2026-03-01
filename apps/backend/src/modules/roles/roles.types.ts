import { UserRole } from '@prisma/client';
import { Permission } from '../../shared/rbac/permissions';

export class RoleError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'RoleError';
  }
}

export interface CreateCustomRoleInput {
  name: string;
  baseRole: UserRole;
  description?: string;
  overrides?: { permission: Permission; allowed: boolean }[];
}

export interface UpdateCustomRoleInput {
  name?: string;
  description?: string;
  permissions?: { permission: Permission; allowed: boolean }[];
}
