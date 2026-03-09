import request from 'supertest';
import { app } from '../../app';
import * as monitoringService from './monitoring-points.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { MonitoringPointError } from './monitoring-points.types';

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

jest.mock('./monitoring-points.service', () => ({
  createMonitoringPoint: jest.fn(),
  listMonitoringPoints: jest.fn(),
  getMonitoringPoint: jest.fn(),
  updateMonitoringPoint: jest.fn(),
  deleteMonitoringPoint: jest.fn(),
  generateGrid: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(monitoringService);
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
const POINT_ID = 'point-1';

const SAMPLE_POINT = {
  id: POINT_ID,
  farmId: FARM_ID,
  fieldPlotId: PLOT_ID,
  code: 'P01',
  latitude: -23.5505,
  longitude: -46.6333,
  notes: null,
  createdAt: '2026-03-09T00:00:00.000Z',
  updatedAt: '2026-03-09T00:00:00.000Z',
};

describe('Monitoring Points routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── POST /org/farms/:farmId/monitoring-points ────────────────────

  describe('POST /api/org/farms/:farmId/monitoring-points', () => {
    const url = `/api/org/farms/${FARM_ID}/monitoring-points`;

    it('creates a monitoring point', async () => {
      mockedService.createMonitoringPoint.mockResolvedValue(SAMPLE_POINT);

      const res = await request(app)
        .post(url)
        .set('Authorization', 'Bearer token')
        .send({ fieldPlotId: PLOT_ID, code: 'P01', latitude: -23.5505, longitude: -46.6333 });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('P01');
      expect(mockedService.createMonitoringPoint).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        expect.objectContaining({ code: 'P01' }),
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_MONITORING_POINT' }),
      );
    });

    it('returns 400 for validation errors', async () => {
      mockedService.createMonitoringPoint.mockRejectedValue(
        new MonitoringPointError('Código do ponto é obrigatório', 400),
      );

      const res = await request(app)
        .post(url)
        .set('Authorization', 'Bearer token')
        .send({ fieldPlotId: PLOT_ID });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Código do ponto é obrigatório');
    });

    it('returns 409 for duplicate code', async () => {
      mockedService.createMonitoringPoint.mockRejectedValue(
        new MonitoringPointError('Já existe um ponto com esse código neste talhão', 409),
      );

      const res = await request(app)
        .post(url)
        .set('Authorization', 'Bearer token')
        .send({ fieldPlotId: PLOT_ID, code: 'P01', latitude: -23.55, longitude: -46.63 });

      expect(res.status).toBe(409);
    });

    it('returns 403 for operators (no farms:update)', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(url)
        .set('Authorization', 'Bearer token')
        .send({ fieldPlotId: PLOT_ID, code: 'P01', latitude: -23.55, longitude: -46.63 });

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /org/farms/:farmId/field-plots/:fieldPlotId/monitoring-points ─

  describe('GET /api/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-points', () => {
    const url = `/api/org/farms/${FARM_ID}/field-plots/${PLOT_ID}/monitoring-points`;

    it('lists monitoring points for a field plot', async () => {
      mockedService.listMonitoringPoints.mockResolvedValue({
        data: [SAMPLE_POINT],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe('P01');
    });

    it('passes query params to service', async () => {
      mockedService.listMonitoringPoints.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await request(app)
        .get(`${url}?page=2&limit=10&search=P01`)
        .set('Authorization', 'Bearer token');

      expect(mockedService.listMonitoringPoints).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        PLOT_ID,
        { page: 2, limit: 10, search: 'P01' },
      );
    });
  });

  // ─── GET /org/farms/:farmId/monitoring-points/:pointId ────────────

  describe('GET /api/org/farms/:farmId/monitoring-points/:pointId', () => {
    const url = `/api/org/farms/${FARM_ID}/monitoring-points/${POINT_ID}`;

    it('returns a monitoring point', async () => {
      mockedService.getMonitoringPoint.mockResolvedValue(SAMPLE_POINT);

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(POINT_ID);
    });

    it('returns 404 when not found', async () => {
      mockedService.getMonitoringPoint.mockRejectedValue(
        new MonitoringPointError('Ponto de monitoramento não encontrado', 404),
      );

      const res = await request(app).get(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /org/farms/:farmId/monitoring-points/:pointId ──────────

  describe('PATCH /api/org/farms/:farmId/monitoring-points/:pointId', () => {
    const url = `/api/org/farms/${FARM_ID}/monitoring-points/${POINT_ID}`;

    it('updates a monitoring point', async () => {
      const updated = { ...SAMPLE_POINT, code: 'P02' };
      mockedService.updateMonitoringPoint.mockResolvedValue(updated);

      const res = await request(app)
        .patch(url)
        .set('Authorization', 'Bearer token')
        .send({ code: 'P02' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('P02');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_MONITORING_POINT' }),
      );
    });

    it('returns 403 for operators', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .patch(url)
        .set('Authorization', 'Bearer token')
        .send({ code: 'P02' });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /org/farms/:farmId/monitoring-points/:pointId ─────────

  describe('DELETE /api/org/farms/:farmId/monitoring-points/:pointId', () => {
    const url = `/api/org/farms/${FARM_ID}/monitoring-points/${POINT_ID}`;

    it('soft-deletes a monitoring point', async () => {
      mockedService.deleteMonitoringPoint.mockResolvedValue(undefined);

      const res = await request(app).delete(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_MONITORING_POINT' }),
      );
    });

    it('returns 404 when not found', async () => {
      mockedService.deleteMonitoringPoint.mockRejectedValue(
        new MonitoringPointError('Ponto de monitoramento não encontrado', 404),
      );

      const res = await request(app).delete(url).set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /org/farms/:farmId/monitoring-points/generate-grid ──────

  describe('POST /api/org/farms/:farmId/monitoring-points/generate-grid', () => {
    const url = `/api/org/farms/${FARM_ID}/monitoring-points/generate-grid`;

    it('generates a grid of monitoring points', async () => {
      const gridPoints = [
        { ...SAMPLE_POINT, id: 'p1', code: 'P01' },
        { ...SAMPLE_POINT, id: 'p2', code: 'P02', latitude: -23.551, longitude: -46.634 },
      ];
      mockedService.generateGrid.mockResolvedValue(gridPoints);

      const res = await request(app)
        .post(url)
        .set('Authorization', 'Bearer token')
        .send({ fieldPlotId: PLOT_ID, spacingMeters: 50 });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GENERATE_MONITORING_GRID' }),
      );
    });

    it('returns 400 for invalid spacing', async () => {
      mockedService.generateGrid.mockRejectedValue(
        new MonitoringPointError('Espaçamento deve estar entre 5 e 500 metros', 400),
      );

      const res = await request(app)
        .post(url)
        .set('Authorization', 'Bearer token')
        .send({ fieldPlotId: PLOT_ID, spacingMeters: 2 });

      expect(res.status).toBe(400);
    });
  });
});
