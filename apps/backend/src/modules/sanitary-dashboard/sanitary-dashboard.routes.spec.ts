import request from 'supertest';
import { app } from '../../app';
import * as sanitaryDashboardService from './sanitary-dashboard.service';
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

jest.mock('./sanitary-dashboard.service', () => ({
  getSanitaryDashboard: jest.fn(),
  exportSanitaryReportCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(sanitaryDashboardService);
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
    vaccinationCoveragePercent: 85,
    animalsInTreatment: 3,
    animalsInWithdrawal: 5,
    upcomingCampaigns: 2,
    pendingExamResults: 4,
    expiredRegulatoryExams: 1,
  },
  pendingAnimals: [
    {
      animalId: 'a-1',
      earTag: '001',
      animalName: 'Mimosa',
      farmName: 'Fazenda Norte',
      lotName: 'Lote A',
      category: 'COW',
      pendingType: 'IN_TREATMENT' as const,
      pendingTypeLabel: 'Em tratamento',
      detail: 'Mastite',
    },
  ],
  costsByCategory: [{ groupKey: 'COW', groupLabel: 'Vaca', totalCostCents: 15000 }],
  costsByLot: [{ groupKey: 'lot-1', groupLabel: 'Lote A', totalCostCents: 12000 }],
  diseaseIncidence: [{ month: '2026-03', diseaseName: 'Mastite', count: 2 }],
  treatmentIncidence: [{ month: '2026-03', diseaseName: 'Vacinação', count: 50 }],
};

describe('Sanitary dashboard routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  describe('GET /api/org/sanitary-dashboard', () => {
    it('should return sanitary dashboard data', async () => {
      mockedService.getSanitaryDashboard.mockResolvedValue(SAMPLE_DASHBOARD);

      const res = await request(app)
        .get('/api/org/sanitary-dashboard')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.kpis.vaccinationCoveragePercent).toBe(85);
      expect(res.body.kpis.animalsInTreatment).toBe(3);
      expect(res.body.pendingAnimals).toHaveLength(1);
      expect(res.body.costsByCategory).toHaveLength(1);
      expect(res.body.diseaseIncidence).toHaveLength(1);
    });

    it('should pass filters to service', async () => {
      mockedService.getSanitaryDashboard.mockResolvedValue(SAMPLE_DASHBOARD);

      await request(app)
        .get('/api/org/sanitary-dashboard?farmId=f-1&category=COW')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getSanitaryDashboard).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ farmId: 'f-1', category: 'COW' }),
      );
    });
  });

  describe('GET /api/org/farms/:farmId/sanitary-dashboard', () => {
    it('should return farm-scoped dashboard', async () => {
      mockedService.getSanitaryDashboard.mockResolvedValue(SAMPLE_DASHBOARD);

      const res = await request(app)
        .get('/api/org/farms/farm-1/sanitary-dashboard')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockedService.getSanitaryDashboard).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ farmId: 'farm-1' }),
      );
    });
  });

  describe('GET /api/org/farms/:farmId/sanitary-dashboard/export', () => {
    it('should export CSV', async () => {
      mockedService.exportSanitaryReportCsv.mockResolvedValue(
        '\uFEFFINDICADORES\n"Cobertura";"85%"',
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/sanitary-dashboard/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('relatorio-sanitario.csv');
    });
  });

  describe('Error handling', () => {
    it('should return 500 on service error', async () => {
      mockedService.getSanitaryDashboard.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/org/sanitary-dashboard')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(500);
    });
  });
});
