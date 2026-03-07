export interface User {
  userId: string;
  email: string;
  role: string;
  organizationId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface FarmListItem {
  id: string;
  name: string;
  nickname: string | null;
  city: string | null;
  state: string;
  totalAreaHa: number;
  boundaryAreaHa: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  landClassification: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  _count: {
    registrations: number;
    fieldPlots: number;
  };
}

export interface FarmsListResponse {
  data: FarmListItem[];
  total: number;
  page: number;
  limit: number;
}
