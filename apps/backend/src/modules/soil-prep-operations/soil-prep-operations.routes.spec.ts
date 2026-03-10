import request from 'supertest';
import { app } from '../../app';
import * as soilPrepService from './soil-prep-operations.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { SoilPrepError } from './soil-prep-operations.types';

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

jest.mock('./soil-prep-operations.service', () => ({
  createSoilPrepOperation: jest.fn(),
  listSoilPrepOperations: jest.fn(),
  getSoilPrepOperation: jest.fn(),
  updateSoilPrepOperation: jest.fn(),
  deleteSoilPrepOperation: jest.fn(),
  createSoilPrepBulk: jest.fn(),
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

const mockedService = jest.mocked(soilPrepService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

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
const OP_ID = 'soil-op-1';

const SAMPLE_OPERATION = {
  id: OP_ID,
  farmId: FARM_ID,
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão Norte',
  fieldPlotAreaHa: 15.5,
  operationTypeId: 'optype-1',
  operationTypeName: 'Aração',
  startedAt: '2026-03-15T08:00:00.000Z',
  endedAt: '2026-03-15T12:00:00.000Z',
  machineName: 'Trator MF 4292',
  implementName: 'Arado reversível 4 discos',
  operatorName: 'João Silva',
  depthCm: 30,
  inputs: [
    {
      productName: 'Calcário dolomítico',
      dose: 2000,
      doseUnit: 'KG_HA',
      totalQuantity: 31000,
      batchCode: 'LOT-2026-001',
    },
  ],
  soilMoisturePercent: 25,
  weatherCondition: 'ENSOLARADO',
  weatherConditionLabel: 'Ensolarado',
  durationHours: 4,
  machineCostPerHour: 150,
  laborCount: 1,
  laborHourCost: 30,
  inputsCost: 800,
  totalCost: 1520,
  notes: 'Solo com boa umidade',
  photoUrl: null,
  latitude: -21.234567,
  longitude: -50.123456,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-15T08:00:00.000Z',
  updatedAt: '2026-03-15T12:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /api/org/farms/:farmId/soil-prep-operations', () => {
  it('should create a soil prep operation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createSoilPrepOperation.mockResolvedValue(SAMPLE_OPERATION);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/soil-prep-operations`)
      .set('Authorization', 'Bearer token')
      .send({
        fieldPlotId: 'plot-1',
        operationTypeName: 'Aração',
        startedAt: '2026-03-15T08:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(OP_ID);
    expect(res.body.operationTypeName).toBe('Aração');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_SOIL_PREP_OPERATION',
        targetType: 'soil_prep_operation',
      }),
    );
  });

  it('should return 400 for missing required fields', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createSoilPrepOperation.mockRejectedValue(
      new SoilPrepError('Talhão é obrigatório', 400),
    );

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/soil-prep-operations`)
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('obrigatório');
  });

  it('should return 404 for non-existent plot', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createSoilPrepOperation.mockRejectedValue(
      new SoilPrepError('Talhão não encontrado nesta fazenda', 404),
    );

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/soil-prep-operations`)
      .set('Authorization', 'Bearer token')
      .send({ fieldPlotId: 'bad', operationTypeName: 'Aração', startedAt: '2026-03-15T08:00:00Z' });

    expect(res.status).toBe(404);
  });

  it('should deny access without farms:update', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/soil-prep-operations`)
      .set('Authorization', 'Bearer token')
      .send({
        fieldPlotId: 'plot-1',
        operationTypeName: 'Aração',
        startedAt: '2026-03-15T08:00:00Z',
      });

    expect(res.status).toBe(403);
  });
});

// ─── BULK CREATE ────────────────────────────────────────────────────

describe('POST /api/org/farms/:farmId/soil-prep-operations/bulk', () => {
  it('should create operations for multiple plots', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createSoilPrepBulk.mockResolvedValue([
      SAMPLE_OPERATION,
      { ...SAMPLE_OPERATION, id: 'soil-op-2', fieldPlotId: 'plot-2' },
    ]);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/soil-prep-operations/bulk`)
      .set('Authorization', 'Bearer token')
      .send({
        fieldPlotIds: ['plot-1', 'plot-2'],
        operationTypeName: 'Calagem',
        startedAt: '2026-03-15T08:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
    expect(res.body.data).toHaveLength(2);
  });

  it('should return 400 if fieldPlotIds is empty', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/soil-prep-operations/bulk`)
      .set('Authorization', 'Bearer token')
      .send({
        fieldPlotIds: [],
        operationTypeName: 'Calagem',
        startedAt: '2026-03-15T08:00:00.000Z',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('fieldPlotIds');
  });

  it('should return 400 if fieldPlotIds is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/soil-prep-operations/bulk`)
      .set('Authorization', 'Bearer token')
      .send({
        operationTypeName: 'Calagem',
        startedAt: '2026-03-15T08:00:00.000Z',
      });

    expect(res.status).toBe(400);
  });
});

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/soil-prep-operations', () => {
  it('should list operations with pagination', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listSoilPrepOperations.mockResolvedValue({
      data: [SAMPLE_OPERATION],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/soil-prep-operations`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('should pass query filters to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listSoilPrepOperations.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    await request(app)
      .get(
        `/api/org/farms/${FARM_ID}/soil-prep-operations?fieldPlotId=plot-1&search=aração&dateFrom=2026-03-01&dateTo=2026-03-31`,
      )
      .set('Authorization', 'Bearer token');

    expect(mockedService.listSoilPrepOperations).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({
        fieldPlotId: 'plot-1',
        search: 'aração',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
      }),
    );
  });
});

// ─── GET ────────────────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/soil-prep-operations/:operationId', () => {
  it('should return a single operation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getSoilPrepOperation.mockResolvedValue(SAMPLE_OPERATION);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/soil-prep-operations/${OP_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(OP_ID);
    expect(res.body.depthCm).toBe(30);
    expect(res.body.inputs).toHaveLength(1);
  });

  it('should return 404 for non-existent operation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getSoilPrepOperation.mockRejectedValue(
      new SoilPrepError('Operação de preparo de solo não encontrada', 404),
    );

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/soil-prep-operations/bad-id`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PATCH /api/org/farms/:farmId/soil-prep-operations/:operationId', () => {
  it('should update an operation', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_OPERATION, depthCm: 35 };
    mockedService.updateSoilPrepOperation.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`/api/org/farms/${FARM_ID}/soil-prep-operations/${OP_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ depthCm: 35 });

    expect(res.status).toBe(200);
    expect(res.body.depthCm).toBe(35);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_SOIL_PREP_OPERATION',
      }),
    );
  });

  it('should return 404 for non-existent operation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateSoilPrepOperation.mockRejectedValue(
      new SoilPrepError('Operação de preparo de solo não encontrada', 404),
    );

    const res = await request(app)
      .patch(`/api/org/farms/${FARM_ID}/soil-prep-operations/bad-id`)
      .set('Authorization', 'Bearer token')
      .send({ depthCm: 35 });

    expect(res.status).toBe(404);
  });

  it('should deny access without farms:update', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .patch(`/api/org/farms/${FARM_ID}/soil-prep-operations/${OP_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ depthCm: 35 });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/org/farms/:farmId/soil-prep-operations/:operationId', () => {
  it('should soft-delete an operation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteSoilPrepOperation.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/org/farms/${FARM_ID}/soil-prep-operations/${OP_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_SOIL_PREP_OPERATION',
      }),
    );
  });

  it('should return 404 for non-existent operation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteSoilPrepOperation.mockRejectedValue(
      new SoilPrepError('Operação de preparo de solo não encontrada', 404),
    );

    const res = await request(app)
      .delete(`/api/org/farms/${FARM_ID}/soil-prep-operations/bad-id`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── INTERNAL SERVER ERROR ──────────────────────────────────────────

describe('Error handling', () => {
  it('should return 500 for unexpected errors', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createSoilPrepOperation.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/soil-prep-operations`)
      .set('Authorization', 'Bearer token')
      .send({
        fieldPlotId: 'plot-1',
        operationTypeName: 'Aração',
        startedAt: '2026-03-15T08:00:00Z',
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });
});
