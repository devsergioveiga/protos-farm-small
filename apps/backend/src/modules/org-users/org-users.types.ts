import { UserRole } from '@prisma/client';

// ─── Assignable roles (ORG_ADMIN can assign these, never SUPER_ADMIN or ADMIN) ─

export const ASSIGNABLE_ROLES: UserRole[] = [
  'MANAGER',
  'AGRONOMIST',
  'FINANCIAL',
  'OPERATOR',
  'COWBOY',
  'CONSULTANT',
];

// ─── Error ──────────────────────────────────────────────────────────

export class OrgUserError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'OrgUserError';
  }
}

// ─── Input types ────────────────────────────────────────────────────

export interface CreateOrgUserInput {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  farmIds?: string[];
}

export interface UpdateOrgUserInput {
  name?: string;
  phone?: string;
  role?: UserRole;
  farmIds?: string[];
}

export interface ListOrgUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  farmId?: string;
  status?: string;
}

// ─── Redis prefixes ─────────────────────────────────────────────────

export const ORG_INVITE_PREFIX = 'org_invite_token:';
