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
});
