import request from 'supertest';
import { app } from '../../app';
import * as weighingService from './animal-weighing.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { AnimalWeighingError } from './animal-weighing.types';

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

jest.mock('./animal-weighing.service', () => ({
  listWeighings: jest.fn(),
  createWeighing: jest.fn(),
  updateWeighing: jest.fn(),
  deleteWeighing: jest.fn(),
  getWeighingStats: jest.fn(),
  exportWeighingsCsv: jest.fn(),
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

const mockedService = jest.mocked(weighingService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

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
const WEIGHING_ID = 'weighing-1';
const BASE_URL = `/api/org/farms/${FARM_ID}/animals/${ANIMAL_ID}/weighings`;

const mockWeighing = {
  id: WEIGHING_ID,
  animalId: ANIMAL_ID,
  farmId: FARM_ID,
  weightKg: 450.5,
  measuredAt: '2026-01-15',
  bodyConditionScore: 3,
  notes: 'Pesagem mensal',
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: new Date().toISOString(),
};

const mockStats = {
  currentWeightKg: 480,
  entryWeightKg: 420,
  totalGainKg: 60,
  gmdKgDay: 0.667,
  minWeightKg: 420,
  maxWeightKg: 480,
  totalWeighings: 3,
};

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /weighings', () => {
  it('returns list of weighings', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listWeighings.mockResolvedValue([mockWeighing]);

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].weightKg).toBe(450.5);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get(BASE_URL);
    expect(res.status).toBe(401);
  });

  it('returns 403 for CONSULTANT on create (no animals:update)', async () => {
    authAs(CONSULTANT_PAYLOAD);
    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer token')
      .send({ weightKg: 450, measuredAt: '2026-01-15' });
    expect(res.status).toBe(403);
  });
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /weighings', () => {
  it('creates a new weighing and logs audit', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createWeighing.mockResolvedValue(mockWeighing);

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer token')
      .send({ weightKg: 450.5, measuredAt: '2026-01-15', bodyConditionScore: 3 });

    expect(res.status).toBe(201);
    expect(res.body.weightKg).toBe(450.5);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_WEIGHING' }),
    );
  });

  it('returns 400 for validation error', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createWeighing.mockRejectedValue(
      new AnimalWeighingError('Peso e data de pesagem são obrigatórios', 400),
    );

    const res = await request(app).post(BASE_URL).set('Authorization', 'Bearer token').send({});

    expect(res.status).toBe(400);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PATCH /weighings/:weighingId', () => {
  it('updates a weighing', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...mockWeighing, weightKg: 460 };
    mockedService.updateWeighing.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`${BASE_URL}/${WEIGHING_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ weightKg: 460 });

    expect(res.status).toBe(200);
    expect(res.body.weightKg).toBe(460);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_WEIGHING' }),
    );
  });

  it('returns 404 when weighing not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateWeighing.mockRejectedValue(
      new AnimalWeighingError('Pesagem não encontrada', 404),
    );

    const res = await request(app)
      .patch(`${BASE_URL}/unknown`)
      .set('Authorization', 'Bearer token')
      .send({ weightKg: 460 });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /weighings/:weighingId', () => {
  it('deletes a weighing', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteWeighing.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`${BASE_URL}/${WEIGHING_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Pesagem excluída com sucesso');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_WEIGHING' }),
    );
  });

  it('returns 404 when weighing not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteWeighing.mockRejectedValue(
      new AnimalWeighingError('Pesagem não encontrada', 404),
    );

    const res = await request(app)
      .delete(`${BASE_URL}/unknown`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── STATS ──────────────────────────────────────────────────────────

describe('GET /weighings/stats', () => {
  it('returns weighing statistics', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getWeighingStats.mockResolvedValue(mockStats);

    const res = await request(app).get(`${BASE_URL}/stats`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.currentWeightKg).toBe(480);
    expect(res.body.gmdKgDay).toBe(0.667);
    expect(res.body.totalWeighings).toBe(3);
  });

  it('returns empty stats when no weighings', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getWeighingStats.mockResolvedValue({
      currentWeightKg: null,
      entryWeightKg: 420,
      totalGainKg: null,
      gmdKgDay: null,
      minWeightKg: null,
      maxWeightKg: null,
      totalWeighings: 0,
    });

    const res = await request(app).get(`${BASE_URL}/stats`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalWeighings).toBe(0);
    expect(res.body.currentWeightKg).toBeNull();
  });
});

// ─── EXPORT ─────────────────────────────────────────────────────────

describe('GET /weighings/export', () => {
  it('returns CSV with proper headers', async () => {
    authAs(ADMIN_PAYLOAD);
    const csvContent =
      '\uFEFFPESAGENS — SH-001\nData;Peso (kg);ECC;Registrado por;Observações\n15/01/2026;450,50;3;Admin;Pesagem mensal';
    mockedService.exportWeighingsCsv.mockResolvedValue(csvContent);

    const res = await request(app).get(`${BASE_URL}/export`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('PESAGENS');
  });
});

// ─── Error handling ─────────────────────────────────────────────────

describe('Error handling', () => {
  it('returns 500 for unexpected errors', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listWeighings.mockRejectedValue(new Error('unexpected'));

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });
});
