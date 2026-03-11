import request from 'supertest';
import { app } from '../../app';
import * as productivityMapService from './productivity-map.service';
import * as authService from '../auth/auth.service';

jest.mock('../../shared/audit/audit.service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./productivity-map.service', () => ({
  getProductivityMap: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(productivityMapService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const VIEWER_PAYLOAD = {
  userId: 'viewer-1',
  email: 'viewer@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const FARM_ID = 'farm-1';

const SAMPLE_RESPONSE = {
  plots: [
    {
      fieldPlotId: 'plot-1',
      fieldPlotName: 'Talhão A',
      fieldPlotAreaHa: 50,
      cultureType: 'GRAOS' as const,
      crop: 'Soja',
      totalProduction: 300,
      productionUnit: 'sc',
      productivityPerHa: 60,
      productivityUnit: 'sc/ha',
      harvestCount: 5,
      level: 'ALTA' as const,
      deviationFromAvg: 20,
      dateRange: { first: '2026-01-15', last: '2026-02-28' },
    },
    {
      fieldPlotId: 'plot-2',
      fieldPlotName: 'Talhão B',
      fieldPlotAreaHa: 30,
      cultureType: 'GRAOS' as const,
      crop: 'Milho',
      totalProduction: 120,
      productionUnit: 'sc',
      productivityPerHa: 40,
      productivityUnit: 'sc/ha',
      harvestCount: 3,
      level: 'BAIXA' as const,
      deviationFromAvg: -20,
      dateRange: { first: '2026-01-20', last: '2026-03-01' },
    },
    {
      fieldPlotId: 'plot-3',
      fieldPlotName: 'Talhão C',
      fieldPlotAreaHa: 20,
      cultureType: 'GRAOS' as const,
      crop: '',
      totalProduction: 0,
      productionUnit: 'sc',
      productivityPerHa: 0,
      productivityUnit: 'sc/ha',
      harvestCount: 0,
      level: 'SEM_DADOS' as const,
      deviationFromAvg: 0,
      dateRange: { first: '', last: '' },
    },
  ],
  summary: {
    totalPlots: 3,
    plotsWithData: 2,
    avgProductivityPerHa: 50,
    productivityUnit: 'sc/ha',
    levels: { ALTA: 1, MEDIA: 0, BAIXA: 1, SEM_DADOS: 1 },
  },
  filters: {
    cultureType: null,
    crop: null,
    dateFrom: null,
    dateTo: null,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/org/farms/:farmId/productivity-map', () => {
  it('returns productivity map data for authenticated admin', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue(SAMPLE_RESPONSE);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.plots).toHaveLength(3);
    expect(res.body.summary.totalPlots).toBe(3);
    expect(res.body.summary.plotsWithData).toBe(2);
    expect(res.body.summary.avgProductivityPerHa).toBe(50);
    expect(mockedService.getProductivityMap).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      FARM_ID,
      {},
    );
  });

  it('returns productivity map for consultant (read-only)', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue(SAMPLE_RESPONSE);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.plots).toHaveLength(3);
  });

  it('passes cultureType filter', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue({
      ...SAMPLE_RESPONSE,
      filters: { ...SAMPLE_RESPONSE.filters, cultureType: 'GRAOS' },
    });

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map?cultureType=GRAOS`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(mockedService.getProductivityMap).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      FARM_ID,
      { cultureType: 'GRAOS' },
    );
  });

  it('passes date range filters', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue(SAMPLE_RESPONSE);

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map?dateFrom=2026-01-01&dateTo=2026-03-31`)
      .set('Authorization', 'Bearer valid-token');

    expect(mockedService.getProductivityMap).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      FARM_ID,
      { dateFrom: '2026-01-01', dateTo: '2026-03-31' },
    );
  });

  it('passes crop filter', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue(SAMPLE_RESPONSE);

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map?crop=Soja`)
      .set('Authorization', 'Bearer valid-token');

    expect(mockedService.getProductivityMap).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      FARM_ID,
      { crop: 'Soja' },
    );
  });

  it('rejects invalid cultureType', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map?cultureType=INVALID`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Tipo de cultura inválido');
    expect(mockedService.getProductivityMap).not.toHaveBeenCalled();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/org/farms/${FARM_ID}/productivity-map`);

    expect(res.status).toBe(401);
  });

  it('returns correct level counts in summary', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue(SAMPLE_RESPONSE);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.body.summary.levels).toEqual({
      ALTA: 1,
      MEDIA: 0,
      BAIXA: 1,
      SEM_DADOS: 1,
    });
  });

  it('includes plot productivity details', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue(SAMPLE_RESPONSE);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map`)
      .set('Authorization', 'Bearer valid-token');

    const plot = res.body.plots[0];
    expect(plot.fieldPlotId).toBe('plot-1');
    expect(plot.fieldPlotName).toBe('Talhão A');
    expect(plot.productivityPerHa).toBe(60);
    expect(plot.level).toBe('ALTA');
    expect(plot.deviationFromAvg).toBe(20);
    expect(plot.crop).toBe('Soja');
    expect(plot.harvestCount).toBe(5);
  });

  it('handles SEM_DADOS plots (no harvest data)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue(SAMPLE_RESPONSE);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map`)
      .set('Authorization', 'Bearer valid-token');

    const emptyPlot = res.body.plots[2];
    expect(emptyPlot.level).toBe('SEM_DADOS');
    expect(emptyPlot.harvestCount).toBe(0);
    expect(emptyPlot.productivityPerHa).toBe(0);
  });

  it('handles service error gracefully', async () => {
    authAs(ADMIN_PAYLOAD);
    const { ProductivityMapError: PMError } = jest.requireActual('./productivity-map.types');
    mockedService.getProductivityMap.mockRejectedValue(new PMError('Fazenda não encontrada', 404));

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Fazenda não encontrada');
  });

  it('handles unknown error with 500', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockRejectedValue(new Error('Unexpected error'));

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/productivity-map`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });

  it('returns all filters in response', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue({
      ...SAMPLE_RESPONSE,
      filters: {
        cultureType: 'CAFE',
        crop: 'Arábica',
        dateFrom: '2026-01-01',
        dateTo: '2026-06-30',
      },
    });

    const res = await request(app)
      .get(
        `/api/org/farms/${FARM_ID}/productivity-map?cultureType=CAFE&crop=Arábica&dateFrom=2026-01-01&dateTo=2026-06-30`,
      )
      .set('Authorization', 'Bearer valid-token');

    expect(res.body.filters).toEqual({
      cultureType: 'CAFE',
      crop: 'Arábica',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
    });
  });

  it('combines multiple filters', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProductivityMap.mockResolvedValue(SAMPLE_RESPONSE);

    await request(app)
      .get(
        `/api/org/farms/${FARM_ID}/productivity-map?cultureType=GRAOS&crop=Soja&dateFrom=2026-01-01`,
      )
      .set('Authorization', 'Bearer valid-token');

    expect(mockedService.getProductivityMap).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      FARM_ID,
      { cultureType: 'GRAOS', crop: 'Soja', dateFrom: '2026-01-01' },
    );
  });
});
