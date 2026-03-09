import request from 'supertest';
import { app } from '../../app';
import * as culturalService from './cultural-operations.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { CulturalOperationError } from './cultural-operations.types';

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

jest.mock('./cultural-operations.service', () => ({
  createCulturalOperation: jest.fn(),
  listCulturalOperations: jest.fn(),
  getCulturalOperation: jest.fn(),
  updateCulturalOperation: jest.fn(),
  deleteCulturalOperation: jest.fn(),
  getOperationTypes: jest.fn(),
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

const mockedService = jest.mocked(culturalService);
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
const OP_ID = 'cult-op-1';

const SAMPLE_OPERATION = {
  id: OP_ID,
  farmId: FARM_ID,
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão Norte',
  performedAt: '2026-03-08T10:00:00.000Z',
  operationType: 'CAPINA_MANUAL',
  operationTypeLabel: 'Capina manual',
  durationHours: 4,
  machineName: null,
  laborCount: 3,
  laborHours: 12,
  irrigationDepthMm: null,
  irrigationTimeMin: null,
  irrigationSystem: null,
  pruningType: null,
  pruningTypeLabel: null,
  pruningPercentage: null,
  machineHourCost: null,
  laborHourCost: 150,
  supplyCost: null,
  totalCost: 150,
  notes: 'Capina na área norte',
  photoUrl: null,
  latitude: null,
  longitude: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin User',
  createdAt: '2026-03-08T10:00:00.000Z',
  updatedAt: '2026-03-08T10:00:00.000Z',
};

describe('Cultural Operations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /types (CA1) ──────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/cultural-operations/types', () => {
    it('returns configurable operation types', async () => {
      authAs(ADMIN_PAYLOAD);
      const types = [
        { value: 'CAPINA_MANUAL', label: 'Capina manual' },
        { value: 'ROCAGEM_MECANICA', label: 'Roçagem mecânica' },
        { value: 'IRRIGACAO', label: 'Irrigação' },
        { value: 'PODA', label: 'Poda' },
        { value: 'DESBROTA', label: 'Desbrota' },
        { value: 'RALEIO', label: 'Raleio' },
        { value: 'QUEBRA_VENTO', label: 'Quebra-vento' },
      ];
      mockedService.getOperationTypes.mockReturnValue(types);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cultural-operations/types`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(7);
      expect(res.body[0]).toEqual({ value: 'CAPINA_MANUAL', label: 'Capina manual' });
      expect(res.body).toEqual(types);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(`/api/org/farms/${FARM_ID}/cultural-operations/types`);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST ──────────────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/cultural-operations', () => {
    const VALID_INPUT = {
      fieldPlotId: 'plot-1',
      performedAt: '2026-03-08T10:00:00.000Z',
      operationType: 'CAPINA_MANUAL',
      durationHours: 4,
      laborCount: 3,
      laborHours: 12,
      notes: 'Capina na área norte',
    };

    it('creates a cultural operation (admin)', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createCulturalOperation.mockResolvedValue(SAMPLE_OPERATION);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/cultural-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send(VALID_INPUT);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(OP_ID);
      expect(res.body.operationType).toBe('CAPINA_MANUAL');
      expect(mockedService.createCulturalOperation).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        'admin-1',
        VALID_INPUT,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_CULTURAL_OPERATION',
          targetType: 'cultural_operation',
          targetId: OP_ID,
        }),
      );
    });

    it('returns 400 for invalid operation type', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createCulturalOperation.mockRejectedValue(
        new CulturalOperationError('Tipo de operação inválido', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/cultural-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send({ ...VALID_INPUT, operationType: 'INVALIDO' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('inválido');
    });

    it('rejects OPERATOR role (no farms:update)', async () => {
      authAs({
        userId: 'viewer-1',
        email: 'viewer@org.com',
        role: 'OPERATOR' as const,
        organizationId: 'org-1',
      });

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/cultural-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send(VALID_INPUT);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/cultural-operations', () => {
    it('lists operations with pagination', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listCulturalOperations.mockResolvedValue({
        data: [SAMPLE_OPERATION],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cultural-operations`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('passes filter parameters', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listCulturalOperations.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get(`/api/org/farms/${FARM_ID}/cultural-operations`)
        .query({
          page: '2',
          limit: '10',
          fieldPlotId: 'plot-1',
          operationType: 'IRRIGACAO',
          search: 'pivô',
          dateFrom: '2026-01-01',
          dateTo: '2026-12-31',
        })
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listCulturalOperations).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        {
          page: 2,
          limit: 10,
          fieldPlotId: 'plot-1',
          operationType: 'IRRIGACAO',
          search: 'pivô',
          dateFrom: '2026-01-01',
          dateTo: '2026-12-31',
        },
      );
    });

    it('operator can list operations (farms:read)', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.listCulturalOperations.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cultural-operations`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
    });
  });

  // ─── GET by ID ─────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/cultural-operations/:operationId', () => {
    it('returns a single operation', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getCulturalOperation.mockResolvedValue(SAMPLE_OPERATION);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cultural-operations/${OP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(OP_ID);
      expect(res.body.operationTypeLabel).toBe('Capina manual');
    });

    it('returns 404 for non-existent operation', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getCulturalOperation.mockRejectedValue(
        new CulturalOperationError('Operação não encontrada', 404),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cultural-operations/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/cultural-operations/:operationId', () => {
    it('updates an operation', async () => {
      authAs(ADMIN_PAYLOAD);
      const updated = { ...SAMPLE_OPERATION, durationHours: 6 };
      mockedService.updateCulturalOperation.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/cultural-operations/${OP_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ durationHours: 6 });

      expect(res.status).toBe(200);
      expect(res.body.durationHours).toBe(6);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_CULTURAL_OPERATION',
        }),
      );
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/cultural-operations/:operationId', () => {
    it('soft deletes an operation', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteCulturalOperation.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/cultural-operations/${OP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_CULTURAL_OPERATION',
          targetId: OP_ID,
        }),
      );
    });

    it('returns 404 for non-existent operation', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteCulturalOperation.mockRejectedValue(
        new CulturalOperationError('Operação não encontrada', 404),
      );

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/cultural-operations/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  // ─── Error handling ────────────────────────────────────────────────

  describe('Error handling', () => {
    it('returns 500 for unexpected errors', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listCulturalOperations.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cultural-operations`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });
  });
});
