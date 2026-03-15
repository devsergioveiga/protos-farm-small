import request from 'supertest';
import { app } from '../../app';
import * as milkDashboardService from './milk-dashboard.service';
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

jest.mock('./milk-dashboard.service', () => ({
  getMilkDashboard: jest.fn(),
  exportMilkDashboardCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(milkDashboardService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const SAMPLE_DASHBOARD = {
  kpis: {
    todayLiters: 450.5,
    monthLiters: 12500,
    accumulatedLiters: 38000,
    avgLitersPerCow: 22.5,
    cowsInLactation: 56,
    dryCows: 12,
  },
  evolution: [
    { date: '2026-03-14', totalLiters: 440 },
    { date: '2026-03-15', totalLiters: 450.5 },
  ],
  topCows: [
    {
      animalId: 'a-1',
      earTag: '001',
      animalName: 'Mimosa',
      totalLiters: 1200,
      avgLitersPerDay: 40,
      lotName: 'Lote A',
    },
  ],
  bottomCows: [
    {
      animalId: 'a-2',
      earTag: '002',
      animalName: 'Estrela',
      totalLiters: 180,
      avgLitersPerDay: 6,
      lotName: 'Lote B',
    },
  ],
  quality: {
    avgScc: 250000,
    avgTbc: 15000,
    sccTrend: 'IMPROVING' as const,
    tbcTrend: 'STABLE' as const,
  },
  financial: {
    costPerLiter: 1.05,
    revenuePerLiter: 2.3,
    marginPerLiter: 1.25,
    totalMargin: 47500,
    breakdown: {
      feedCost: 30400,
      healthCost: 1500,
      laborCost: 5700,
    },
  },
};

describe('Milk dashboard routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  describe('GET /api/org/farms/:farmId/milk-dashboard', () => {
    it('should return milk dashboard data with default period', async () => {
      mockedService.getMilkDashboard.mockResolvedValue(SAMPLE_DASHBOARD);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.kpis.todayLiters).toBe(450.5);
      expect(res.body.kpis.cowsInLactation).toBe(56);
      expect(res.body.kpis.dryCows).toBe(12);
      expect(res.body.evolution).toHaveLength(2);
      expect(res.body.topCows).toHaveLength(1);
      expect(res.body.bottomCows).toHaveLength(1);
      expect(res.body.quality.sccTrend).toBe('IMPROVING');
      expect(res.body.financial.marginPerLiter).toBe(1.25);
    });

    it('should pass period filter to service', async () => {
      mockedService.getMilkDashboard.mockResolvedValue(SAMPLE_DASHBOARD);

      await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard?period=90d')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getMilkDashboard).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ farmId: 'farm-1', period: '90d' }),
      );
    });

    it('should pass lotId filter to service', async () => {
      mockedService.getMilkDashboard.mockResolvedValue(SAMPLE_DASHBOARD);

      await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard?lotId=lot-1')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getMilkDashboard).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ farmId: 'farm-1', lotId: 'lot-1' }),
      );
    });

    it('should pass breedName filter to service', async () => {
      mockedService.getMilkDashboard.mockResolvedValue(SAMPLE_DASHBOARD);

      await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard?breedName=Holandesa')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getMilkDashboard).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ farmId: 'farm-1', breedName: 'Holandesa' }),
      );
    });

    it('should return 400 for invalid period', async () => {
      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard?period=7d')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Período inválido');
    });

    it('should use default period 30d when not specified', async () => {
      mockedService.getMilkDashboard.mockResolvedValue(SAMPLE_DASHBOARD);

      await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getMilkDashboard).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ period: '30d' }),
      );
    });

    it('should return 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const res = await request(app).get('/api/org/farms/farm-1/milk-dashboard');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/org/farms/:farmId/milk-dashboard/export', () => {
    it('should export CSV with correct headers', async () => {
      mockedService.exportMilkDashboardCsv.mockResolvedValue(
        '\uFEFFINDICADORES DE PRODUÇÃO DE LEITE\n"Produção hoje (L)";"450.5"',
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('dashboard-leite.csv');
    });

    it('should pass query params to CSV export', async () => {
      mockedService.exportMilkDashboardCsv.mockResolvedValue('\uFEFFdata');

      await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard/export?period=365d&lotId=lot-1')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.exportMilkDashboardCsv).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ farmId: 'farm-1', period: '365d', lotId: 'lot-1' }),
      );
    });
  });

  describe('Error handling', () => {
    it('should return 500 on service error', async () => {
      mockedService.getMilkDashboard.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });

    it('should return custom status code for domain errors', async () => {
      const err = Object.assign(new Error('Fazenda não encontrada'), { statusCode: 404 });
      mockedService.getMilkDashboard.mockRejectedValue(err);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-dashboard')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Fazenda não encontrada');
    });
  });
});
