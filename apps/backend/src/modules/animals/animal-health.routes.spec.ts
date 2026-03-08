import request from 'supertest';
import { app } from '../../app';
import * as healthService from './animal-health.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { AnimalHealthError } from './animal-health.types';

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

jest.mock('./animal-health.service', () => ({
  listHealthRecords: jest.fn(),
  createHealthRecord: jest.fn(),
  bulkCreateHealthRecords: jest.fn(),
  updateHealthRecord: jest.fn(),
  deleteHealthRecord: jest.fn(),
  getHealthStats: jest.fn(),
  exportHealthRecordsCsv: jest.fn(),
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

const mockedService = jest.mocked(healthService);
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
const RECORD_ID = 'health-1';
const BASE_URL = `/api/org/farms/${FARM_ID}/animals/${ANIMAL_ID}/health`;

const mockRecord = {
  id: RECORD_ID,
  animalId: ANIMAL_ID,
  farmId: FARM_ID,
  type: 'VACCINATION' as const,
  eventDate: '2026-03-01',
  productName: 'Aftosa Bivalente',
  dosage: '5ml',
  applicationMethod: 'INJECTABLE' as const,
  batchNumber: 'LOT-2026-A',
  diagnosis: null,
  durationDays: null,
  examResult: null,
  labName: null,
  isFieldExam: null,
  veterinaryName: 'Dr. Silva',
  notes: 'Vacinação campanha',
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: new Date().toISOString(),
};

const mockStats = {
  totalRecords: 5,
  vaccinations: 2,
  dewormings: 1,
  treatments: 1,
  exams: 1,
  lastVaccinationDate: '2026-03-01',
  lastDewormingDate: '2026-02-15',
  lastTreatmentDate: '2026-01-20',
  lastExamDate: '2026-01-10',
};

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns list of health records', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listHealthRecords.mockResolvedValue([mockRecord]);

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe('VACCINATION');
    expect(res.body[0].productName).toBe('Aftosa Bivalente');
  });

  it('passes type filter to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listHealthRecords.mockResolvedValue([]);

    await request(app).get(`${BASE_URL}?type=DEWORMING`).set('Authorization', 'Bearer token');

    expect(mockedService.listHealthRecords).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      ANIMAL_ID,
      'DEWORMING',
    );
  });

  it('ignores invalid type filter', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listHealthRecords.mockResolvedValue([]);

    await request(app).get(`${BASE_URL}?type=INVALID`).set('Authorization', 'Bearer token');

    expect(mockedService.listHealthRecords).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      ANIMAL_ID,
      undefined,
    );
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
      .send({ type: 'VACCINATION', eventDate: '2026-03-01' });
    expect(res.status).toBe(403);
  });
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /health', () => {
  it('creates a new health record and logs audit', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createHealthRecord.mockResolvedValue(mockRecord);

    const res = await request(app).post(BASE_URL).set('Authorization', 'Bearer token').send({
      type: 'VACCINATION',
      eventDate: '2026-03-01',
      productName: 'Aftosa Bivalente',
      dosage: '5ml',
      applicationMethod: 'INJECTABLE',
    });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('VACCINATION');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_HEALTH_RECORD' }),
    );
  });

  it('returns 400 for validation error', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createHealthRecord.mockRejectedValue(
      new AnimalHealthError('Tipo e data do evento são obrigatórios', 400),
    );

    const res = await request(app).post(BASE_URL).set('Authorization', 'Bearer token').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('obrigatórios');
  });

  it('returns 404 when animal not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createHealthRecord.mockRejectedValue(
      new AnimalHealthError('Animal não encontrado', 404),
    );

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer token')
      .send({ type: 'VACCINATION', eventDate: '2026-03-01' });

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PATCH /health/:recordId', () => {
  it('updates a health record', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...mockRecord, productName: 'Brucelose B-19' };
    mockedService.updateHealthRecord.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`${BASE_URL}/${RECORD_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ productName: 'Brucelose B-19' });

    expect(res.status).toBe(200);
    expect(res.body.productName).toBe('Brucelose B-19');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_HEALTH_RECORD' }),
    );
  });

  it('returns 404 when record not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateHealthRecord.mockRejectedValue(
      new AnimalHealthError('Registro sanitário não encontrado', 404),
    );

    const res = await request(app)
      .patch(`${BASE_URL}/unknown`)
      .set('Authorization', 'Bearer token')
      .send({ productName: 'test' });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /health/:recordId', () => {
  it('deletes a health record', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteHealthRecord.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`${BASE_URL}/${RECORD_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Registro sanitário excluído com sucesso');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_HEALTH_RECORD' }),
    );
  });

  it('returns 404 when record not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteHealthRecord.mockRejectedValue(
      new AnimalHealthError('Registro sanitário não encontrado', 404),
    );

    const res = await request(app)
      .delete(`${BASE_URL}/unknown`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── STATS ──────────────────────────────────────────────────────────

describe('GET /health/stats', () => {
  it('returns health statistics', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHealthStats.mockResolvedValue(mockStats);

    const res = await request(app).get(`${BASE_URL}/stats`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalRecords).toBe(5);
    expect(res.body.vaccinations).toBe(2);
    expect(res.body.lastVaccinationDate).toBe('2026-03-01');
  });

  it('returns zero stats when no records', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHealthStats.mockResolvedValue({
      totalRecords: 0,
      vaccinations: 0,
      dewormings: 0,
      treatments: 0,
      exams: 0,
      lastVaccinationDate: null,
      lastDewormingDate: null,
      lastTreatmentDate: null,
      lastExamDate: null,
    });

    const res = await request(app).get(`${BASE_URL}/stats`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalRecords).toBe(0);
    expect(res.body.lastVaccinationDate).toBeNull();
  });
});

// ─── EXPORT ─────────────────────────────────────────────────────────

describe('GET /health/export', () => {
  it('returns CSV with proper headers', async () => {
    authAs(ADMIN_PAYLOAD);
    const csvContent =
      '\uFEFFHISTÓRICO SANITÁRIO — SH-001\nData;Tipo;Produto\n01/03/2026;Vacinação;Aftosa';
    mockedService.exportHealthRecordsCsv.mockResolvedValue(csvContent);

    const res = await request(app).get(`${BASE_URL}/export`).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('HISTÓRICO SANITÁRIO');
  });
});

// ─── POST /org/farms/:farmId/animals/bulk-health ───────────────────

describe('POST /org/farms/:farmId/animals/bulk-health', () => {
  const BULK_URL = `/api/org/farms/${FARM_ID}/animals/bulk-health`;

  it('should create health records for multiple animals', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.bulkCreateHealthRecords.mockResolvedValue({
      created: 3,
      failed: 0,
      errors: [],
    });

    const res = await request(app)
      .post(BULK_URL)
      .set('Authorization', 'Bearer token')
      .send({
        animalIds: ['a1', 'a2', 'a3'],
        type: 'VACCINATION',
        eventDate: '2026-03-01',
        productName: 'Aftosa',
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(3);
    expect(res.body.failed).toBe(0);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BULK_CREATE_HEALTH_RECORD',
        metadata: expect.objectContaining({ animalCount: 3, created: 3 }),
      }),
    );
  });

  it('should return 400 when animalIds is empty', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(BULK_URL)
      .set('Authorization', 'Bearer token')
      .send({ animalIds: [], type: 'VACCINATION', eventDate: '2026-03-01' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('animalIds');
  });

  it('should return 400 when animalIds is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(BULK_URL)
      .set('Authorization', 'Bearer token')
      .send({ type: 'VACCINATION', eventDate: '2026-03-01' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('animalIds');
  });

  it('should handle partial failures', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.bulkCreateHealthRecords.mockResolvedValue({
      created: 2,
      failed: 1,
      errors: [{ animalId: 'a3', error: 'Animal não encontrado' }],
    });

    const res = await request(app)
      .post(BULK_URL)
      .set('Authorization', 'Bearer token')
      .send({
        animalIds: ['a1', 'a2', 'a3'],
        type: 'DEWORMING',
        eventDate: '2026-03-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(2);
    expect(res.body.failed).toBe(1);
    expect(res.body.errors).toHaveLength(1);
  });
});

// ─── Error handling ─────────────────────────────────────────────────

describe('Error handling', () => {
  it('returns 500 for unexpected errors', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listHealthRecords.mockRejectedValue(new Error('unexpected'));

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });
});
