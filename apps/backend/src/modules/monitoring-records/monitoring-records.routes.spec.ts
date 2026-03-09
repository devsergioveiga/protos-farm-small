import request from 'supertest';
import { app } from '../../app';
import * as recordsService from './monitoring-records.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { MonitoringRecordError } from './monitoring-records.types';

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

jest.mock('./monitoring-records.service', () => ({
  createMonitoringRecord: jest.fn(),
  listMonitoringRecords: jest.fn(),
  getMonitoringRecord: jest.fn(),
  updateMonitoringRecord: jest.fn(),
  deleteMonitoringRecord: jest.fn(),
  getMonitoringHeatmap: jest.fn(),
  getMonitoringTimeline: jest.fn(),
  getMonitoringRecommendations: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(recordsService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const FARM_ID = 'farm-1';
const PLOT_ID = 'plot-1';
const RECORD_ID = 'record-1';

const SAMPLE_RECORD = {
  id: RECORD_ID,
  farmId: FARM_ID,
  fieldPlotId: PLOT_ID,
  monitoringPointId: 'point-1',
  monitoringPointCode: 'P01',
  pestId: 'pest-1',
  pestName: 'Lagarta-da-soja',
  pestCategory: 'INSETO',
  observedAt: '2026-03-09T10:00:00.000Z',
  infestationLevel: 'MODERADO',
  infestationLevelLabel: 'Moderado',
  sampleCount: 5,
  pestCount: 12,
  growthStage: 'V4',
  hasNaturalEnemies: true,
  naturalEnemiesDesc: 'Percevejos predadores',
  damagePercentage: 15.5,
  photoUrl: null,
  notes: 'Folhas com dano visível',
  createdAt: '2026-03-09T10:00:00.000Z',
  updatedAt: '2026-03-09T10:00:00.000Z',
};

describe('Monitoring Records routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── POST ─────────────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-records', () => {
    const url = `/api/org/farms/${FARM_ID}/field-plots/${PLOT_ID}/monitoring-records`;

    it('creates a monitoring record', async () => {
      mockedService.createMonitoringRecord.mockResolvedValue(SAMPLE_RECORD);

      const res = await request(app).post(url).set('Authorization', 'Bearer token').send({
        monitoringPointId: 'point-1',
        pestId: 'pest-1',
        observedAt: '2026-03-09T10:00:00.000Z',
        infestationLevel: 'MODERADO',
        sampleCount: 5,
        pestCount: 12,
        growthStage: 'V4',
        hasNaturalEnemies: true,
        naturalEnemiesDesc: 'Percevejos predadores',
      });

      expect(res.status).toBe(201);
      expect(res.body.infestationLevel).toBe('MODERADO');
      expect(res.body.pestName).toBe('Lagarta-da-soja');
      expect(mockedService.createMonitoringRecord).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        PLOT_ID,
        expect.objectContaining({ pestId: 'pest-1', infestationLevel: 'MODERADO' }),
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_MONITORING_RECORD' }),
      );
    });

    it('returns 400 for validation errors', async () => {
      mockedService.createMonitoringRecord.mockRejectedValue(
        new MonitoringRecordError('Ponto de monitoramento é obrigatório', 400),
      );

      const res = await request(app)
        .post(url)
        .set('Authorization', 'Bearer token')
        .send({ pestId: 'pest-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Ponto de monitoramento é obrigatório');
    });

    it('returns 404 when monitoring point not found', async () => {
      mockedService.createMonitoringRecord.mockRejectedValue(
        new MonitoringRecordError('Ponto de monitoramento não encontrado neste talhão', 404),
      );

      const res = await request(app).post(url).set('Authorization', 'Bearer token').send({
        monitoringPointId: 'nonexistent',
        pestId: 'pest-1',
        observedAt: '2026-03-09T10:00:00.000Z',
        infestationLevel: 'BAIXO',
      });

      expect(res.status).toBe(404);
    });

    it('returns 403 for operators (no farms:update)', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app).post(url).set('Authorization', 'Bearer token').send({
        monitoringPointId: 'point-1',
        pestId: 'pest-1',
        observedAt: '2026-03-09T10:00:00.000Z',
        infestationLevel: 'BAIXO',
      });

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-records', () => {
    const url = `/api/org/farms/${FARM_ID}/field-plots/${PLOT_ID}/monitoring-records`;

    it('lists monitoring records', async () => {
      mockedService.listMonitoringRecords.mockResolvedValue({
        data: [SAMPLE_RECORD],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].pestName).toBe('Lagarta-da-soja');
    });

    it('passes filter params to service', async () => {
      mockedService.listMonitoringRecords.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get(
          `${url}?monitoringPointId=point-1&pestId=pest-1&infestationLevel=ALTO&startDate=2026-03-01&endDate=2026-03-31`,
        )
        .set('Authorization', 'Bearer token');

      expect(mockedService.listMonitoringRecords).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        PLOT_ID,
        {
          page: undefined,
          limit: undefined,
          monitoringPointId: 'point-1',
          pestId: 'pest-1',
          infestationLevel: 'ALTO',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
        },
      );
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/monitoring-records/:recordId', () => {
    const url = `/api/org/farms/${FARM_ID}/monitoring-records/${RECORD_ID}`;

    it('returns a monitoring record', async () => {
      mockedService.getMonitoringRecord.mockResolvedValue(SAMPLE_RECORD);

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(RECORD_ID);
      expect(res.body.monitoringPointCode).toBe('P01');
    });

    it('returns 404 when not found', async () => {
      mockedService.getMonitoringRecord.mockRejectedValue(
        new MonitoringRecordError('Registro de monitoramento não encontrado', 404),
      );

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── HEATMAP ──────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-heatmap', () => {
    const url = `/api/org/farms/${FARM_ID}/field-plots/${PLOT_ID}/monitoring-heatmap`;

    const SAMPLE_HEATMAP = [
      {
        monitoringPointId: 'point-1',
        code: 'P01',
        latitude: -15.5,
        longitude: -47.5,
        intensity: 0.75,
        maxLevel: 'ALTO' as const,
        recordCount: 3,
        topPests: [{ pestId: 'pest-1', pestName: 'Lagarta-da-soja', count: 2 }],
      },
    ];

    it('returns heatmap data', async () => {
      mockedService.getMonitoringHeatmap.mockResolvedValue(SAMPLE_HEATMAP);

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].intensity).toBe(0.75);
      expect(res.body.data[0].maxLevel).toBe('ALTO');
    });

    it('passes filter params to service', async () => {
      mockedService.getMonitoringHeatmap.mockResolvedValue([]);

      await request(app)
        .get(`${url}?pestId=pest-1&startDate=2026-03-01&endDate=2026-03-31`)
        .set('Authorization', 'Bearer token');

      expect(mockedService.getMonitoringHeatmap).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        PLOT_ID,
        { pestId: 'pest-1', startDate: '2026-03-01', endDate: '2026-03-31' },
      );
    });

    it('returns empty array when no records', async () => {
      mockedService.getMonitoringHeatmap.mockResolvedValue([]);

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─── PATCH ────────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/monitoring-records/:recordId', () => {
    const url = `/api/org/farms/${FARM_ID}/monitoring-records/${RECORD_ID}`;

    it('updates a monitoring record', async () => {
      const updated = { ...SAMPLE_RECORD, infestationLevel: 'ALTO', infestationLevelLabel: 'Alto' };
      mockedService.updateMonitoringRecord.mockResolvedValue(updated);

      const res = await request(app)
        .patch(url)
        .set('Authorization', 'Bearer token')
        .send({ infestationLevel: 'ALTO' });

      expect(res.status).toBe(200);
      expect(res.body.infestationLevel).toBe('ALTO');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_MONITORING_RECORD' }),
      );
    });

    it('returns 403 for operators', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .patch(url)
        .set('Authorization', 'Bearer token')
        .send({ infestationLevel: 'ALTO' });

      expect(res.status).toBe(403);
    });
  });

  // ─── TIMELINE ────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-timeline', () => {
    const url = `/api/org/farms/${FARM_ID}/field-plots/${PLOT_ID}/monitoring-timeline`;

    const SAMPLE_TIMELINE = {
      data: [
        {
          date: '2026-03-01',
          pests: [
            {
              pestId: 'pest-1',
              pestName: 'Lagarta-da-soja',
              avgIntensity: 0.5,
              maxLevel: 'MODERADO',
              recordCount: 3,
            },
          ],
        },
        {
          date: '2026-03-02',
          pests: [
            {
              pestId: 'pest-1',
              pestName: 'Lagarta-da-soja',
              avgIntensity: 0.75,
              maxLevel: 'ALTO',
              recordCount: 2,
            },
          ],
        },
      ],
      summary: {
        totalRecords: 5,
        dateRange: { start: '2026-03-01', end: '2026-03-02' },
        pestsFound: ['pest-1'],
      },
    };

    const EMPTY_TIMELINE = {
      data: [],
      summary: {
        totalRecords: 0,
        dateRange: { start: '', end: '' },
        pestsFound: [],
      },
    };

    it('returns timeline data with daily aggregation', async () => {
      mockedService.getMonitoringTimeline.mockResolvedValue(SAMPLE_TIMELINE);

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].date).toBe('2026-03-01');
      expect(res.body.data[0].pests[0].pestName).toBe('Lagarta-da-soja');
      expect(res.body.summary.totalRecords).toBe(5);
    });

    it('returns empty data when no records', async () => {
      mockedService.getMonitoringTimeline.mockResolvedValue(EMPTY_TIMELINE);

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.summary.totalRecords).toBe(0);
    });

    it('passes pestIds filter (comma-separated)', async () => {
      mockedService.getMonitoringTimeline.mockResolvedValue(EMPTY_TIMELINE);

      await request(app).get(`${url}?pestIds=pest-1,pest-2`).set('Authorization', 'Bearer token');

      expect(mockedService.getMonitoringTimeline).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        PLOT_ID,
        expect.objectContaining({ pestIds: 'pest-1,pest-2' }),
      );
    });

    it('passes date range and aggregation params', async () => {
      mockedService.getMonitoringTimeline.mockResolvedValue(EMPTY_TIMELINE);

      await request(app)
        .get(`${url}?startDate=2026-02-01&endDate=2026-03-09&aggregation=weekly`)
        .set('Authorization', 'Bearer token');

      expect(mockedService.getMonitoringTimeline).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        PLOT_ID,
        {
          pestIds: undefined,
          startDate: '2026-02-01',
          endDate: '2026-03-09',
          aggregation: 'weekly',
        },
      );
    });

    it('passes monthly aggregation', async () => {
      mockedService.getMonitoringTimeline.mockResolvedValue(EMPTY_TIMELINE);

      await request(app).get(`${url}?aggregation=monthly`).set('Authorization', 'Bearer token');

      expect(mockedService.getMonitoringTimeline).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        PLOT_ID,
        expect.objectContaining({ aggregation: 'monthly' }),
      );
    });

    it('ignores invalid aggregation value', async () => {
      mockedService.getMonitoringTimeline.mockResolvedValue(EMPTY_TIMELINE);

      await request(app).get(`${url}?aggregation=invalid`).set('Authorization', 'Bearer token');

      expect(mockedService.getMonitoringTimeline).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        PLOT_ID,
        expect.objectContaining({ aggregation: undefined }),
      );
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get(url);

      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/monitoring-records/:recordId', () => {
    const url = `/api/org/farms/${FARM_ID}/monitoring-records/${RECORD_ID}`;

    it('soft-deletes a monitoring record', async () => {
      mockedService.deleteMonitoringRecord.mockResolvedValue(undefined);

      const res = await request(app).delete(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_MONITORING_RECORD' }),
      );
    });

    it('returns 404 when not found', async () => {
      mockedService.deleteMonitoringRecord.mockRejectedValue(
        new MonitoringRecordError('Registro de monitoramento não encontrado', 404),
      );

      const res = await request(app).delete(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── RECOMMENDATIONS ──────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/field-plots/:plotId/monitoring-recommendations', () => {
    const url = `/api/org/farms/${FARM_ID}/field-plots/${PLOT_ID}/monitoring-recommendations`;

    const SAMPLE_RECOMMENDATION = {
      pestId: 'pest-1',
      pestName: 'Lagarta-da-soja',
      pestCategory: 'INSETO',
      pestCategoryLabel: 'Inseto',
      severity: 'ALTO',
      severityLabel: 'Alto',
      controlThreshold: 'MODERADO',
      controlThresholdLabel: 'Moderado',
      ndeDescription: '20% folhas raspadas',
      ncDescription: '2 lagartas por planta',
      recommendedProducts: 'Clorantraniliprole 200g/L — 100-150 mL/ha',
      urgency: 'ALERTA' as const,
      urgencyLabel: 'Alerta',
      affectedPoints: [
        {
          monitoringPointId: 'point-1',
          code: 'P01',
          latitude: -23.5,
          longitude: -46.6,
          currentLevel: 'ALTO',
          currentLevelLabel: 'Alto',
          lastObservedAt: '2026-03-09T10:00:00.000Z',
          damagePercentage: 15.5,
        },
      ],
      affectedPointCount: 1,
      maxLevel: 'ALTO',
      maxLevelLabel: 'Alto',
      avgDamagePercentage: 15.5,
      hasNaturalEnemies: true,
      trend: 'increasing' as const,
      trendLabel: 'Em alta',
    };

    const SAMPLE_SUMMARY = {
      totalRecommendations: 1,
      criticalCount: 0,
      alertCount: 1,
      totalAffectedPoints: 1,
    };

    it('returns recommendations with 200', async () => {
      mockedService.getMonitoringRecommendations.mockResolvedValue({
        data: [SAMPLE_RECOMMENDATION],
        summary: SAMPLE_SUMMARY,
      });

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].pestName).toBe('Lagarta-da-soja');
      expect(res.body.data[0].urgency).toBe('ALERTA');
      expect(res.body.data[0].controlThreshold).toBe('MODERADO');
      expect(res.body.data[0].affectedPoints).toHaveLength(1);
      expect(res.body.summary.totalRecommendations).toBe(1);
      expect(res.body.summary.alertCount).toBe(1);
    });

    it('returns empty data when no thresholds exceeded', async () => {
      mockedService.getMonitoringRecommendations.mockResolvedValue({
        data: [],
        summary: {
          totalRecommendations: 0,
          criticalCount: 0,
          alertCount: 0,
          totalAffectedPoints: 0,
        },
      });

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.summary.totalRecommendations).toBe(0);
    });

    it('passes query params to service', async () => {
      mockedService.getMonitoringRecommendations.mockResolvedValue({
        data: [],
        summary: {
          totalRecommendations: 0,
          criticalCount: 0,
          alertCount: 0,
          totalAffectedPoints: 0,
        },
      });

      await request(app)
        .get(`${url}?pestId=pest-1&urgency=CRITICO`)
        .set('Authorization', 'Bearer token');

      expect(mockedService.getMonitoringRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        FARM_ID,
        PLOT_ID,
        { pestId: 'pest-1', urgency: 'CRITICO' },
      );
    });

    it('returns 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).get(url);

      expect(res.status).toBe(401);
    });

    it('returns 403 for VIEWER role', async () => {
      authAs({
        userId: 'viewer-1',
        email: 'viewer@org.com',
        role: 'VIEWER' as const,
        organizationId: 'org-1',
      });

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });
  });
});
