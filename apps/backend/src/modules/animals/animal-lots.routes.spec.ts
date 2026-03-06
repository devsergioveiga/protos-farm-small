import request from 'supertest';
import { app } from '../../app';
import * as animalLotsService from './animal-lots.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { AnimalLotError } from './animal-lots.types';

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

jest.mock('./animal-lots.service', () => ({
  createLot: jest.fn(),
  listLots: jest.fn(),
  getLot: jest.fn(),
  updateLot: jest.fn(),
  softDeleteLot: jest.fn(),
  moveAnimalsToLot: jest.fn(),
  removeAnimalsFromLot: jest.fn(),
  getLotDashboard: jest.fn(),
  getLotCompositionHistory: jest.fn(),
  getLotsWithCapacityAlerts: jest.fn(),
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

const mockedService = jest.mocked(animalLotsService);
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

const CONSULTANT_PAYLOAD = {
  userId: 'consult-1',
  email: 'consult@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(
  payload: typeof ADMIN_PAYLOAD | typeof OPERATOR_PAYLOAD | typeof CONSULTANT_PAYLOAD,
) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const FARM_ID = 'farm-1';
const LOT_ID = 'lot-1';

const mockLot = {
  id: LOT_ID,
  farmId: FARM_ID,
  name: 'Lote Maternidade',
  predominantCategory: 'BEZERRA',
  currentLocation: 'Pasto 3',
  locationType: 'PASTO',
  maxCapacity: 30,
  description: null,
  notes: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _count: { animals: 12 },
};

// ─── POST /org/farms/:farmId/lots ──────────────────────────────────

describe('POST /org/farms/:farmId/lots', () => {
  it('should create lot and return 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createLot.mockResolvedValue(mockLot as never);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/lots`)
      .set('Authorization', 'Bearer valid')
      .send({
        name: 'Lote Maternidade',
        predominantCategory: 'BEZERRA',
        currentLocation: 'Pasto 3',
        locationType: 'PASTO',
        maxCapacity: 30,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Lote Maternidade');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_LOT' }),
    );
  });

  it('should return 400 when required fields are missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/lots`)
      .set('Authorization', 'Bearer valid')
      .send({ name: 'Test' });

    expect(res.status).toBe(400);
  });

  it('should return 422 on duplicate name', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createLot.mockRejectedValue(
      new AnimalLotError("Lote 'Lote Maternidade' já existe nesta fazenda", 422),
    );

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/lots`)
      .set('Authorization', 'Bearer valid')
      .send({
        name: 'Lote Maternidade',
        predominantCategory: 'BEZERRA',
        currentLocation: 'Pasto 3',
        locationType: 'PASTO',
      });

    expect(res.status).toBe(422);
  });

  it('should return 403 for CONSULTANT', async () => {
    authAs(CONSULTANT_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/lots`)
      .set('Authorization', 'Bearer valid')
      .send({
        name: 'Test',
        predominantCategory: 'BEZERRA',
        currentLocation: 'Pasto',
        locationType: 'PASTO',
      });

    expect(res.status).toBe(403);
  });
});

// ─── GET /org/farms/:farmId/lots ───────────────────────────────────

describe('GET /org/farms/:farmId/lots', () => {
  it('should list lots with pagination', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listLots.mockResolvedValue({
      data: [mockLot] as never,
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/lots`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('should pass query params to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listLots.mockResolvedValue({
      data: [] as never,
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/lots?search=mat&category=BEZERRA&locationType=PASTO`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.listLots).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({
        search: 'mat',
        category: 'BEZERRA',
        locationType: 'PASTO',
      }),
    );
  });
});

// ─── GET /org/farms/:farmId/lots/:lotId ────────────────────────────

describe('GET /org/farms/:farmId/lots/:lotId', () => {
  it('should return lot detail', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getLot.mockResolvedValue(mockLot as never);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Lote Maternidade');
  });

  it('should return 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getLot.mockRejectedValue(new AnimalLotError('Lote não encontrado', 404));

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/lots/nonexistent`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /org/farms/:farmId/lots/:lotId ──────────────────────────

describe('PATCH /org/farms/:farmId/lots/:lotId', () => {
  it('should update lot', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateLot.mockResolvedValue({ ...mockLot, name: 'Lote Recria' } as never);

    const res = await request(app)
      .patch(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}`)
      .set('Authorization', 'Bearer valid')
      .send({ name: 'Lote Recria' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Lote Recria');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_LOT' }),
    );
  });
});

// ─── DELETE /org/farms/:farmId/lots/:lotId ─────────────────────────

describe('DELETE /org/farms/:farmId/lots/:lotId', () => {
  it('should soft delete lot', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.softDeleteLot.mockResolvedValue(mockLot as never);

    const res = await request(app)
      .delete(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_LOT' }),
    );
  });

  it('should return 403 for OPERATOR (no animals:delete)', async () => {
    authAs(OPERATOR_PAYLOAD);

    const res = await request(app)
      .delete(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(403);
  });
});

// ─── POST /org/farms/:farmId/lots/:lotId/move ──────────────────────

describe('POST /org/farms/:farmId/lots/:lotId/move', () => {
  it('should move animals to lot', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.moveAnimalsToLot.mockResolvedValue({ moved: 3, warning: null });

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}/move`)
      .set('Authorization', 'Bearer valid')
      .send({ animalIds: ['a1', 'a2', 'a3'], reason: 'Manejo' });

    expect(res.status).toBe(200);
    expect(res.body.moved).toBe(3);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MOVE_ANIMALS_TO_LOT' }),
    );
  });

  it('should return 400 when animalIds missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}/move`)
      .set('Authorization', 'Bearer valid')
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return capacity warning', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.moveAnimalsToLot.mockResolvedValue({
      moved: 5,
      warning: 'Capacidade excedida: 35/30 animais',
    });

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}/move`)
      .set('Authorization', 'Bearer valid')
      .send({ animalIds: ['a1', 'a2', 'a3', 'a4', 'a5'] });

    expect(res.status).toBe(200);
    expect(res.body.warning).toContain('Capacidade excedida');
  });
});

// ─── POST /org/farms/:farmId/lots/:lotId/remove ────────────────────

describe('POST /org/farms/:farmId/lots/:lotId/remove', () => {
  it('should remove animals from lot', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.removeAnimalsFromLot.mockResolvedValue({ removed: 2 });

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}/remove`)
      .set('Authorization', 'Bearer valid')
      .send({ animalIds: ['a1', 'a2'] });

    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(2);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REMOVE_ANIMALS_FROM_LOT' }),
    );
  });
});

// ─── GET /org/farms/:farmId/lots/:lotId/dashboard ──────────────────

describe('GET /org/farms/:farmId/lots/:lotId/dashboard', () => {
  it('should return lot dashboard', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getLotDashboard.mockResolvedValue({
      animalCount: 12,
      maxCapacity: 30,
      capacityPercent: 40,
      isOverCapacity: false,
      avgWeightKg: 450,
      avgProductionLDay: null,
      avgDaysInLot: 45,
    });

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}/dashboard`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.body.animalCount).toBe(12);
    expect(res.body.avgProductionLDay).toBeNull();
  });
});

// ─── GET /org/farms/:farmId/lots/:lotId/history ────────────────────

describe('GET /org/farms/:farmId/lots/:lotId/history', () => {
  it('should return composition history', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getLotCompositionHistory.mockResolvedValue([
      { date: '2026-01', animalCount: 8, categories: { BEZERRA: 5, BEZERRO: 3 } },
      { date: '2026-02', animalCount: 12, categories: { BEZERRA: 7, BEZERRO: 5 } },
    ]);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/lots/${LOT_ID}/history`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].date).toBe('2026-01');
  });
});

// ─── GET /org/farms/:farmId/lots/alerts ────────────────────────────

describe('GET /org/farms/:farmId/lots/alerts', () => {
  it('should return capacity alerts', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getLotsWithCapacityAlerts.mockResolvedValue([
      { id: LOT_ID, name: 'Lote Maternidade', currentCount: 35, maxCapacity: 30, overBy: 5 },
    ]);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/lots/alerts`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].overBy).toBe(5);
  });
});
