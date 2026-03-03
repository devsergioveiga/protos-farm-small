import type { PaginationMeta } from './admin';

export interface OrgUserFarmAccess {
  farm: {
    id: string;
    name: string;
  };
}

export interface OrgUserListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt: string | null;
  createdAt: string;
  farmAccess: OrgUserFarmAccess[];
}

export interface OrgUsersResponse {
  data: OrgUserListItem[];
  meta: PaginationMeta;
}

export interface OrgUserDetail extends OrgUserListItem {
  updatedAt: string;
}

export interface CreateOrgUserPayload {
  name: string;
  email: string;
  phone?: string;
  role: string;
  farmIds?: string[];
}

export interface UpdateOrgUserPayload {
  name?: string;
  phone?: string;
  role?: string;
  farmIds?: string[];
}

export interface UserLimitInfo {
  current: number;
  max: number;
  percentage: number;
  warning: boolean;
  blocked: boolean;
}
