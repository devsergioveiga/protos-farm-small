export interface FarmRegistration {
  id: string;
  farmId: string;
  number: string;
  cnsCode: string | null;
  cartorioName: string;
  comarca: string;
  state: string;
  livro: string | null;
  registrationDate: string | null;
  areaHa: number;
  boundaryAreaHa: number | null;
  createdAt: string;
  updatedAt: string;
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

export interface FarmDetail {
  id: string;
  name: string;
  nickname: string | null;
  address: string | null;
  city: string | null;
  state: string;
  zipCode: string | null;
  totalAreaHa: number;
  boundaryAreaHa: number | null;
  cib: string | null;
  incraCode: string | null;
  carCode: string | null;
  ccirCode: string | null;
  landClassification: string | null;
  productive: boolean | null;
  appAreaHa: number | null;
  legalReserveHa: number | null;
  taxableAreaHa: number | null;
  usableAreaHa: number | null;
  latitude: number | null;
  longitude: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  registrations: FarmRegistration[];
  createdAt: string;
  updatedAt: string;
}

export interface FarmsListResponse {
  data: FarmListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BoundaryInfo {
  hasBoundary: boolean;
  boundaryAreaHa: number | null;
  boundaryGeoJSON: GeoJSON.Polygon | null;
}

export interface FieldPlot {
  id: string;
  farmId: string;
  registrationId: string | null;
  name: string;
  code: string | null;
  soilType: string | null;
  currentCrop: string | null;
  previousCrop: string | null;
  notes: string | null;
  boundaryAreaHa: number;
  status: string;
  createdAt: string;
}

export interface FieldPlotsSummary {
  totalPlotAreaHa: number;
  farmTotalAreaHa: number;
  unmappedAreaHa: number;
  plotCount: number;
}
