export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Organization {
  id: string;
  name: string;
  type: 'PF' | 'PJ';
  document: string;
  plan: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  maxUsers: number;
  maxFarms: number;
  allowMultipleSessions: boolean;
  allowSocialLogin: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
    farms: number;
  };
}

export interface OrganizationsResponse {
  data: Organization[];
  meta: PaginationMeta;
}

export interface AdminDashboardStats {
  organizations: {
    total: number;
    active: number;
    suspended: number;
    cancelled: number;
    byPlan: Array<{ plan: string; count: number }>;
  };
  users: {
    total: number;
  };
  farms: {
    total: number;
  };
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  farmId: string | null;
  organizationId: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  meta: PaginationMeta;
}

export interface CreateOrganizationPayload {
  name: string;
  type: 'PF' | 'PJ';
  document: string;
  plan?: string;
  maxUsers?: number;
  maxFarms?: number;
}

export interface CreateOrgAdminPayload {
  name: string;
  email: string;
  phone?: string;
}

export interface OrgUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}
