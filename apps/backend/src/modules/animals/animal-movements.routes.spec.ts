import request from 'supertest';
import { app } from '../../app';
import * as movementsService from './animal-movements.service';
import * as authService from '../auth/auth.service';
import { AnimalMovementsError } from './animal-movements.types';

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

jest.mock('./animal-movements.service', () => ({
  listAnimalMovements: jest.fn(),
  getAnimalMovementStats: jest.fn(),
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

const mockedService = jest.mocked(movementsService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const CONSULTANT_PAYLOAD = {
  userId: 'consult-1',
  email: 'consult@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(payload: typeof ADMIN_PAYLOAD | typeof CONSULTANT_PAYLOAD) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const FARM_ID = 'farm-1';
const ANIMAL_ID = 'animal-1';
const BASE_URL = `/api/org/farms/${FARM_ID}/animals/${ANIMAL_ID}/movements`;

const mockMovement = {
  id: 'mov-1',
  lotName: 'Lote Lactação',
  lotLocationType: 'GALPAO',
  locationName: 'Galpão de Ordenha',
  previousLotName: 'Lote Maternidade',
  enteredAt: '2026-01-15T00:00:00.000Z',
  exitedAt: null,
  durationDays: 50,
  reason: 'Início lactação',
  movedByName: 'Admin',
};

const mockStats = {
  totalMovements: 3,
  currentLotName: 'Lote Lactação',
  currentLocationName: 'Galpão de Ordenha',
  daysInCurrentLot: 50,
  distinctLots: 2,
};

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /movements', () => {
  it('returns list of movements', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimalMovements.mockResolvedValue([mockMovement]);

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].lotName).toBe('Lote Lactação');
    expect(res.body[0].previousLotName).toBe('Lote Maternidade');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get(BASE_URL);
    expect(res.status).toBe(401);
  });

  it('returns 404 when animal not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimalMovements.mockRejectedValue(
      new AnimalMovementsError('Animal não encontrado', 404),
    );

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Animal não encontrado');
  });

  it('CONSULTANT can read movements', async () => {
    authAs(CONSULTANT_PAYLOAD);
    mockedService.listAnimalMovements.mockResolvedValue([]);

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
  });
});

// ─── STATS ──────────────────────────────────────────────────────────

describe('GET /movements/stats', () => {
  it('returns movement statistics', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getAnimalMovementStats.mockResolvedValue(mockStats);

    const res = await request(app).get(`${BASE_URL}/stats`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalMovements).toBe(3);
    expect(res.body.currentLotName).toBe('Lote Lactação');
    expect(res.body.daysInCurrentLot).toBe(50);
    expect(res.body.distinctLots).toBe(2);
  });

  it('returns zero stats when no movements', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getAnimalMovementStats.mockResolvedValue({
      totalMovements: 0,
      currentLotName: null,
      currentLocationName: null,
      daysInCurrentLot: null,
      distinctLots: 0,
    });

    const res = await request(app).get(`${BASE_URL}/stats`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalMovements).toBe(0);
    expect(res.body.currentLotName).toBeNull();
  });

  it('returns 404 when animal not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getAnimalMovementStats.mockRejectedValue(
      new AnimalMovementsError('Animal não encontrado', 404),
    );

    const res = await request(app).get(`${BASE_URL}/stats`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── Error handling ─────────────────────────────────────────────────

describe('Error handling', () => {
  it('returns 500 for unexpected errors', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimalMovements.mockRejectedValue(new Error('unexpected'));

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });
});
