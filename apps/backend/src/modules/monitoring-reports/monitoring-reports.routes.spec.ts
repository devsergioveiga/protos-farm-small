import request from 'supertest';
import { app } from '../../app';
import * as reportService from './monitoring-reports.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { MonitoringReportError } from './monitoring-reports.types';

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

jest.mock('./monitoring-reports.service', () => ({
  generateMonitoringReport: jest.fn(),
  generateMonitoringReportExcel: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(reportService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

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

const FARM_ID = 'farm-1';

const SAMPLE_REPORT = {
  summary: {
    farmName: 'Fazenda Teste',
    reportPeriod: { start: '2026-01-01', end: '2026-03-01' },
    generatedAt: '2026-03-01T12:00:00.000Z',
    totalMonitoringPoints: 10,
    totalPestsMonitored: 3,
    totalMonitoringRecords: 42,
    plotsIncluded: [
      { id: 'plot-1', name: 'Talhão A', monitoringPointCount: 5, recordCount: 20 },
      { id: 'plot-2', name: 'Talhão B', monitoringPointCount: 5, recordCount: 22 },
    ],
  },
  pestSummary: [
    {
      pestId: 'pest-1',
      commonName: 'Lagarta-da-soja',
      scientificName: 'Anticarsia gemmatalis',
      category: 'INSETO',
      categoryLabel: 'Inseto',
      affectedCrops: ['Soja'],
      peakLevel: 'ALTO',
      peakLevelLabel: 'Alto',
      firstDetected: '2026-01-10',
      lastDetected: '2026-02-25',
      recordCount: 20,
      affectedPointCount: 6,
      hasNaturalEnemies: true,
    },
  ],
  detailedAnalysis: [
    {
      pestId: 'pest-1',
      pestName: 'Lagarta-da-soja',
      scientificName: 'Anticarsia gemmatalis',
      category: 'INSETO',
      timeline: [
        { date: '2026-01-06', avgIntensity: 0.25, recordCount: 5 },
        { date: '2026-01-13', avgIntensity: 0.5, recordCount: 8 },
      ],
      trend: 'increasing' as const,
      trendLabel: 'Em alta',
      controlDecisions: [
        {
          date: '2026-01-13',
          urgency: 'ALERTA',
          urgencyLabel: 'Alerta',
          affectedPointCount: 4,
          maxLevel: 'ALTO',
          maxLevelLabel: 'Alto',
          justification:
            'Infestação atingiu nível Alto, acima do NC (Moderado). 4 registro(s) na semana.',
        },
      ],
      naturalEnemiesObserved: true,
      ndeDescription: '20 lagartas/m linear',
      ncDescription: '15 lagartas/m linear',
      recommendedProducts: 'Baculovirus, Bt',
    },
  ],
};

describe('Monitoring Reports Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /monitoring-report ───────────────────────────────────

  describe('GET /api/org/farms/:farmId/monitoring-report', () => {
    it('should return the MIP report JSON', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.generateMonitoringReport.mockResolvedValue(SAMPLE_REPORT);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report`)
        .set('Authorization', 'Bearer valid-token')
        .query({ startDate: '2026-01-01', endDate: '2026-03-01' });

      expect(res.status).toBe(200);
      expect(res.body.summary.farmName).toBe('Fazenda Teste');
      expect(res.body.pestSummary).toHaveLength(1);
      expect(res.body.detailedAnalysis).toHaveLength(1);
      expect(mockedService.generateMonitoringReport).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        { startDate: '2026-01-01', endDate: '2026-03-01', fieldPlotIds: undefined },
      );
    });

    it('should pass fieldPlotIds filter', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.generateMonitoringReport.mockResolvedValue(SAMPLE_REPORT);

      await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report`)
        .set('Authorization', 'Bearer valid-token')
        .query({ fieldPlotIds: 'plot-1,plot-2' });

      expect(mockedService.generateMonitoringReport).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        { startDate: undefined, endDate: undefined, fieldPlotIds: 'plot-1,plot-2' },
      );
    });

    it('should log audit on report generation', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.generateMonitoringReport.mockResolvedValue(SAMPLE_REPORT);

      await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report`)
        .set('Authorization', 'Bearer valid-token');

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GENERATE_MONITORING_REPORT',
          targetType: 'farm',
          targetId: FARM_ID,
          metadata: expect.objectContaining({ format: 'json' }),
        }),
      );
    });

    it('should return 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report`)
        .set('Authorization', 'Bearer invalid');

      expect(res.status).toBe(401);
    });

    it('should return error from service', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.generateMonitoringReport.mockRejectedValue(
        new MonitoringReportError('Fazenda não encontrada', 404),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Fazenda não encontrada');
    });

    it('should return 500 on unexpected error', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.generateMonitoringReport.mockRejectedValue(new Error('DB down'));

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── GET /monitoring-report/excel ─────────────────────────────

  describe('GET /api/org/farms/:farmId/monitoring-report/excel', () => {
    it('should return an Excel file', async () => {
      authAs(ADMIN_PAYLOAD);
      const fakeBuffer = Buffer.from('fake-xlsx');
      mockedService.generateMonitoringReportExcel.mockResolvedValue(fakeBuffer);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report/excel`)
        .set('Authorization', 'Bearer valid-token')
        .query({ startDate: '2026-01-01', endDate: '2026-03-01' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain('relatorio-mip-');
      expect(res.headers['content-disposition']).toContain('.xlsx');
    });

    it('should use farm name in filename when provided', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.generateMonitoringReportExcel.mockResolvedValue(Buffer.from('fake'));

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report/excel`)
        .set('Authorization', 'Bearer valid-token')
        .query({ _farmName: 'Fazenda Sol' });

      expect(res.headers['content-disposition']).toContain('relatorio-mip-fazenda-sol-');
    });

    it('should log audit for Excel export', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.generateMonitoringReportExcel.mockResolvedValue(Buffer.from('fake'));

      await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report/excel`)
        .set('Authorization', 'Bearer valid-token');

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GENERATE_MONITORING_REPORT',
          metadata: expect.objectContaining({ format: 'excel' }),
        }),
      );
    });

    it('should return error from service', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.generateMonitoringReportExcel.mockRejectedValue(
        new MonitoringReportError('Data inicial deve ser anterior à data final', 400),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/monitoring-report/excel`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Data inicial deve ser anterior à data final');
    });
  });
});
