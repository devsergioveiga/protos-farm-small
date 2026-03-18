import request from 'supertest';
import { app } from '../../app';
import * as plantingService from './planting-operations.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { PlantingError } from './planting-operations.types';

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

jest.mock('./planting-operations.service', () => ({
  createPlantingOperation: jest.fn(),
  listPlantingOperations: jest.fn(),
  getPlantingOperation: jest.fn(),
  updatePlantingOperation: jest.fn(),
  deletePlantingOperation: jest.fn(),
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

const mockedService = jest.mocked(plantingService);
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
const OP_ID = 'planting-op-1';

const SAMPLE_OPERATION = {
  id: OP_ID,
  farmId: FARM_ID,
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão Norte',
  fieldPlotAreaHa: 15.5,
  cultivarId: 'cultivar-1',
  cultivarName: 'TMG 2381',
  operationTypeId: null,
  seasonYear: '2025/2026',
  seasonType: 'SAFRA',
  seasonTypeLabel: 'Safra',
  crop: 'Soja',
  plantingDate: '2025-10-15',
  plantedAreaPercent: 100,
  plantedAreaHa: 15.5,
  populationPerM: 14.5,
  rowSpacingCm: 50,
  depthCm: 4,
  seedRateKgHa: 65,
  seedTreatments: [
    {
      productName: 'Standak Top',
      dose: 200,
      doseUnit: 'ML_100KG',
      responsibleTechnician: 'Eng. Maria',
    },
  ],
  baseFertilizations: [
    {
      formulation: '04-20-20',
      doseKgHa: 300,
      applicationMode: 'SULCO',
      totalQuantity: 4650,
    },
  ],
  machineName: 'Plantadeira John Deere 2130',
  operatorName: 'Carlos Silva',
  averageSpeedKmH: 6.5,
  seedCost: 1200,
  fertilizerCost: 1800,
  treatmentCost: 350,
  operationCost: 450,
  totalCost: 3800,
  notes: 'Plantio realizado com solo em ótima condição',
  photoUrl: null,
  latitude: -21.234567,
  longitude: -50.123456,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2025-10-15T08:00:00.000Z',
  updatedAt: '2025-10-15T12:00:00.000Z',
  seedProductId: null,
  stockOutputId: null,
  totalSeedQuantityUsed: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /api/org/farms/:farmId/planting-operations', () => {
  const URL = `/api/org/farms/${FARM_ID}/planting-operations`;

  it('should create a planting operation and return 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPlantingOperation.mockResolvedValue(SAMPLE_OPERATION);

    const res = await request(app).post(URL).set('Authorization', 'Bearer token').send({
      fieldPlotId: 'plot-1',
      cultivarId: 'cultivar-1',
      seasonYear: '2025/2026',
      crop: 'Soja',
      plantingDate: '2025-10-15',
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(OP_ID);
    expect(res.body.crop).toBe('Soja');
    expect(res.body.cultivarName).toBe('TMG 2381');
    expect(mockedService.createPlantingOperation).toHaveBeenCalledTimes(1);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_PLANTING_OPERATION',
        targetType: 'planting_operation',
        targetId: OP_ID,
      }),
    );
  });

  it('should return 400 for missing required fields', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPlantingOperation.mockRejectedValue(
      new PlantingError('Cultura é obrigatória', 400),
    );

    const res = await request(app)
      .post(URL)
      .set('Authorization', 'Bearer token')
      .send({ fieldPlotId: 'plot-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cultura é obrigatória');
  });

  it('should return 404 when plot not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPlantingOperation.mockRejectedValue(
      new PlantingError('Talhão não encontrado nesta fazenda', 404),
    );

    const res = await request(app).post(URL).set('Authorization', 'Bearer token').send({
      fieldPlotId: 'nonexistent',
      seasonYear: '2025/2026',
      crop: 'Soja',
      plantingDate: '2025-10-15',
    });

    expect(res.status).toBe(404);
  });

  it('should return 403 for VIEWER role', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app).post(URL).set('Authorization', 'Bearer token').send({
      fieldPlotId: 'plot-1',
      seasonYear: '2025/2026',
      crop: 'Soja',
      plantingDate: '2025-10-15',
    });

    expect(res.status).toBe(403);
    expect(mockedService.createPlantingOperation).not.toHaveBeenCalled();
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).post(URL).send({});
    expect(res.status).toBe(401);
  });
});

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/planting-operations', () => {
  const URL = `/api/org/farms/${FARM_ID}/planting-operations`;

  it('should list planting operations with pagination', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPlantingOperations.mockResolvedValue({
      data: [SAMPLE_OPERATION],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app).get(URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].crop).toBe('Soja');
  });

  it('should pass query filters to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPlantingOperations.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await request(app)
      .get(
        `${URL}?fieldPlotId=plot-1&crop=Soja&seasonYear=2025/2026&search=milho&dateFrom=2025-01-01&dateTo=2025-12-31&page=2&limit=10`,
      )
      .set('Authorization', 'Bearer token');

    expect(mockedService.listPlantingOperations).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({
        fieldPlotId: 'plot-1',
        crop: 'Soja',
        seasonYear: '2025/2026',
        search: 'milho',
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
        page: 2,
        limit: 10,
      }),
    );
  });
});

// ─── GET ────────────────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/planting-operations/:operationId', () => {
  const URL = `/api/org/farms/${FARM_ID}/planting-operations/${OP_ID}`;

  it('should return a single planting operation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPlantingOperation.mockResolvedValue(SAMPLE_OPERATION);

    const res = await request(app).get(URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(OP_ID);
    expect(res.body.seedTreatments).toHaveLength(1);
    expect(res.body.baseFertilizations).toHaveLength(1);
  });

  it('should return 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPlantingOperation.mockRejectedValue(
      new PlantingError('Operação de plantio não encontrada', 404),
    );

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/planting-operations/nonexistent`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PATCH /api/org/farms/:farmId/planting-operations/:operationId', () => {
  const URL = `/api/org/farms/${FARM_ID}/planting-operations/${OP_ID}`;

  it('should update a planting operation', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_OPERATION, crop: 'Milho', plantedAreaPercent: 80 };
    mockedService.updatePlantingOperation.mockResolvedValue(updated);

    const res = await request(app)
      .patch(URL)
      .set('Authorization', 'Bearer token')
      .send({ crop: 'Milho', plantedAreaPercent: 80 });

    expect(res.status).toBe(200);
    expect(res.body.crop).toBe('Milho');
    expect(res.body.plantedAreaPercent).toBe(80);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_PLANTING_OPERATION',
      }),
    );
  });

  it('should return 400 for invalid area percent', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updatePlantingOperation.mockRejectedValue(
      new PlantingError('Percentual de área plantada deve estar entre 0 e 100', 400),
    );

    const res = await request(app)
      .patch(URL)
      .set('Authorization', 'Bearer token')
      .send({ plantedAreaPercent: 150 });

    expect(res.status).toBe(400);
  });

  it('should return 403 for VIEWER role', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .patch(URL)
      .set('Authorization', 'Bearer token')
      .send({ crop: 'Milho' });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/org/farms/:farmId/planting-operations/:operationId', () => {
  const URL = `/api/org/farms/${FARM_ID}/planting-operations/${OP_ID}`;

  it('should soft-delete a planting operation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deletePlantingOperation.mockResolvedValue(undefined);

    const res = await request(app).delete(URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(mockedService.deletePlantingOperation).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      OP_ID,
    );
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_PLANTING_OPERATION',
      }),
    );
  });

  it('should return 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deletePlantingOperation.mockRejectedValue(
      new PlantingError('Operação de plantio não encontrada', 404),
    );

    const res = await request(app).delete(URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });

  it('should return 403 for VIEWER role', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app).delete(URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});
