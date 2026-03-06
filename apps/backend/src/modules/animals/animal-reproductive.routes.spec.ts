import request from 'supertest';
import { app } from '../../app';
import * as reproductiveService from './animal-reproductive.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { AnimalReproductiveError } from './animal-reproductive.types';

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

jest.mock('./animal-reproductive.service', () => ({
  listReproductiveRecords: jest.fn(),
  createReproductiveRecord: jest.fn(),
  updateReproductiveRecord: jest.fn(),
  deleteReproductiveRecord: jest.fn(),
  getReproductiveStats: jest.fn(),
  exportReproductiveRecordsCsv: jest.fn(),
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

const mockedService = jest.mocked(reproductiveService);
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
const RECORD_ID = 'repro-1';
const BASE_URL = `/api/org/farms/${FARM_ID}/animals/${ANIMAL_ID}/reproductive`;

const mockRecord = {
  id: RECORD_ID,
  animalId: ANIMAL_ID,
  farmId: FARM_ID,
  type: 'HEAT' as const,
  eventDate: '2026-01-15',
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  approvedBy: null,
  criteriaDetails: null,
  heatIntensity: 'MODERATE' as const,
  intervalDays: 21,
  plannedSireId: null,
  plannedSireName: null,
  breedingMethod: null,
  plannedDate: null,
  sireId: null,
  sireName: null,
  semenBatch: null,
  technicianName: null,
  confirmationMethod: null,
  confirmationDate: null,
  expectedDueDate: null,
  calvingType: null,
  calvingComplications: null,
  calfId: null,
  calfEarTag: null,
  calfSex: null,
  calfWeightKg: null,
  createdAt: '2026-01-15T10:00:00.000Z',
};

const mockStats = {
  totalRecords: 5,
  clearances: 1,
  heats: 2,
  breedingPlans: 0,
  ais: 1,
  pregnancies: 1,
  calvings: 0,
  lastHeatDate: '2026-01-15',
  lastAiDate: '2026-02-01',
  lastCalvingDate: null,
  isPregnant: true,
  averageHeatIntervalDays: 21,
};

// ─── GET /stats ─────────────────────────────────────────────────────

describe('GET /reproductive/stats', () => {
  it('returns stats for authenticated user', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getReproductiveStats.mockResolvedValue(mockStats);

    const res = await request(app).get(`${BASE_URL}/stats`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalRecords).toBe(5);
    expect(res.body.isPregnant).toBe(true);
    expect(res.body.averageHeatIntervalDays).toBe(21);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`${BASE_URL}/stats`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when animal not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getReproductiveStats.mockRejectedValue(
      new AnimalReproductiveError('Animal não encontrado', 404),
    );

    const res = await request(app).get(`${BASE_URL}/stats`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── GET /export ────────────────────────────────────────────────────

describe('GET /reproductive/export', () => {
  it('returns CSV content', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.exportReproductiveRecordsCsv.mockResolvedValue(
      '\uFEFFHISTÓRICO REPRODUTIVO — SH-001\nData;Tipo',
    );

    const res = await request(app).get(`${BASE_URL}/export`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('HISTÓRICO REPRODUTIVO');
  });
});

// ─── GET /reproductive ──────────────────────────────────────────────

describe('GET /reproductive', () => {
  it('lists records', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listReproductiveRecords.mockResolvedValue([mockRecord]);

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe('HEAT');
  });

  it('filters by type', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listReproductiveRecords.mockResolvedValue([mockRecord]);

    const res = await request(app)
      .get(`${BASE_URL}?type=HEAT`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listReproductiveRecords).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      ANIMAL_ID,
      'HEAT',
    );
  });

  it('ignores invalid type filter', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listReproductiveRecords.mockResolvedValue([]);

    await request(app).get(`${BASE_URL}?type=INVALID`).set('Authorization', 'Bearer token');

    expect(mockedService.listReproductiveRecords).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      ANIMAL_ID,
      undefined,
    );
  });
});

// ─── POST /reproductive ─────────────────────────────────────────────

describe('POST /reproductive', () => {
  it('creates a record', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createReproductiveRecord.mockResolvedValue(mockRecord);

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer token')
      .send({ type: 'HEAT', eventDate: '2026-01-15', heatIntensity: 'MODERATE' });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('HEAT');
    expect(mockedAudit.logAudit).toHaveBeenCalled();
  });

  it('returns 400 for invalid input', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createReproductiveRecord.mockRejectedValue(
      new AnimalReproductiveError('Tipo e data do evento são obrigatórios', 400),
    );

    const res = await request(app).post(BASE_URL).set('Authorization', 'Bearer token').send({});

    expect(res.status).toBe(400);
  });

  it('denies CONSULTANT create (no animals:update)', async () => {
    authAs(CONSULTANT_PAYLOAD);

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer token')
      .send({ type: 'HEAT', eventDate: '2026-01-15' });

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /reproductive/:recordId ──────────────────────────────────

describe('PATCH /reproductive/:recordId', () => {
  it('updates a record', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...mockRecord, heatIntensity: 'STRONG' as const };
    mockedService.updateReproductiveRecord.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`${BASE_URL}/${RECORD_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ heatIntensity: 'STRONG' });

    expect(res.status).toBe(200);
    expect(res.body.heatIntensity).toBe('STRONG');
    expect(mockedAudit.logAudit).toHaveBeenCalled();
  });

  it('returns 404 for missing record', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateReproductiveRecord.mockRejectedValue(
      new AnimalReproductiveError('Registro reprodutivo não encontrado', 404),
    );

    const res = await request(app)
      .patch(`${BASE_URL}/${RECORD_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ notes: 'test' });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE /reproductive/:recordId ─────────────────────────────────

describe('DELETE /reproductive/:recordId', () => {
  it('deletes a record', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteReproductiveRecord.mockResolvedValue();

    const res = await request(app)
      .delete(`${BASE_URL}/${RECORD_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('excluído');
    expect(mockedAudit.logAudit).toHaveBeenCalled();
  });

  it('returns 404 for missing record', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteReproductiveRecord.mockRejectedValue(
      new AnimalReproductiveError('Registro reprodutivo não encontrado', 404),
    );

    const res = await request(app)
      .delete(`${BASE_URL}/${RECORD_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });

  it('denies CONSULTANT delete', async () => {
    authAs(CONSULTANT_PAYLOAD);

    const res = await request(app)
      .delete(`${BASE_URL}/${RECORD_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});

// ─── Error handling ─────────────────────────────────────────────────

describe('Error handling', () => {
  it('returns 500 for unexpected errors', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listReproductiveRecords.mockRejectedValue(new Error('DB down'));

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });
});
