import request from 'supertest';
import { app } from '../../app';
import * as reproductiveReleasesService from './reproductive-releases.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  ReproductiveReleaseError,
  type ReleaseItem,
  type CriteriaItem,
  type CandidateItem,
  type BulkReleaseResult,
  type ReleaseIndicators,
} from './reproductive-releases.types';

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

jest.mock('./reproductive-releases.service', () => ({
  getCriteria: jest.fn(),
  setCriteria: jest.fn(),
  getCandidates: jest.fn(),
  createRelease: jest.fn(),
  bulkRelease: jest.fn(),
  listReleases: jest.fn(),
  getRelease: jest.fn(),
  getIndicators: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(reproductiveReleasesService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'op-1',
  email: 'op@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const SAMPLE_RELEASE: ReleaseItem = {
  id: 'rel-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  releaseDate: '2026-03-14',
  weightKg: 320,
  ageMonths: 24,
  bodyConditionScore: 3.5,
  previousCategory: 'BEZERRA',
  previousLotId: 'lot-recria',
  previousLotName: 'Recria Fêmeas',
  targetLotId: 'lot-repro',
  targetLotName: 'Novilhas Aptas',
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_CRITERIA: CriteriaItem = {
  id: 'crit-1',
  organizationId: 'org-1',
  minWeightKg: 300,
  minAgeMonths: 20,
  minBodyScore: 3,
  targetLotId: 'lot-repro',
  targetLotName: 'Novilhas Aptas',
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
};

const SAMPLE_CANDIDATE: CandidateItem = {
  animalId: 'animal-2',
  earTag: '002',
  animalName: 'Estrela',
  category: 'BEZERRA',
  birthDate: '2024-03-14',
  ageMonths: 24,
  lastWeightKg: 320,
  lastWeighingDate: '2026-03-10',
  bodyConditionScore: 3,
  lotId: 'lot-recria',
  lotName: 'Recria Fêmeas',
  meetsWeight: true,
  meetsAge: true,
  meetsScore: true,
  meetsAll: true,
};

const SAMPLE_BULK_RESULT: BulkReleaseResult = {
  released: 5,
  failed: 1,
  errors: [{ animalId: 'animal-bad', reason: 'Animal não encontrado' }],
};

const SAMPLE_INDICATORS: ReleaseIndicators = {
  totalReleased: 10,
  avgAgeMonths: 22.5,
  avgWeightKg: 315.2,
  avgRearingTimeDays: 680,
};

describe('Reproductive Releases routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── GET CRITERIA (CA2) ─────────────────────────────────────────────

  describe('GET /api/org/reproductive-criteria', () => {
    it('should return criteria when found', async () => {
      mockedService.getCriteria.mockResolvedValue(SAMPLE_CRITERIA);

      const res = await request(app)
        .get('/api/org/reproductive-criteria')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.minWeightKg).toBe(300);
      expect(res.body.minAgeMonths).toBe(20);
    });

    it('should return null when no criteria configured', async () => {
      mockedService.getCriteria.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/org/reproductive-criteria')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('should return 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).get('/api/org/reproductive-criteria');

      expect(res.status).toBe(401);
    });
  });

  // ─── SET CRITERIA (CA2) ─────────────────────────────────────────────

  describe('PUT /api/org/reproductive-criteria', () => {
    const validInput = {
      minWeightKg: 300,
      minAgeMonths: 20,
      minBodyScore: 3,
      targetLotId: 'lot-repro',
    };

    it('should upsert criteria and return 200', async () => {
      mockedService.setCriteria.mockResolvedValue(SAMPLE_CRITERIA);

      const res = await request(app)
        .put('/api/org/reproductive-criteria')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(200);
      expect(res.body.minWeightKg).toBe(300);
      expect(mockedService.setCriteria).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for invalid body score', async () => {
      mockedService.setCriteria.mockRejectedValue(
        new ReproductiveReleaseError('Escore corporal mínimo deve estar entre 1 e 5', 400),
      );

      const res = await request(app)
        .put('/api/org/reproductive-criteria')
        .set('Authorization', 'Bearer tok')
        .send({ minBodyScore: 6 });

      expect(res.status).toBe(400);
    });

    it('should deny access to OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .put('/api/org/reproductive-criteria')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── CANDIDATES (CA6) ──────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/reproductive-releases/candidates', () => {
    it('should return candidate list', async () => {
      mockedService.getCandidates.mockResolvedValue([SAMPLE_CANDIDATE]);

      const res = await request(app)
        .get('/api/org/farms/farm-1/reproductive-releases/candidates')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].animalId).toBe('animal-2');
      expect(res.body[0].meetsAll).toBe(true);
    });

    it('should return empty array when no candidates', async () => {
      mockedService.getCandidates.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/org/farms/farm-1/reproductive-releases/candidates')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // ─── CREATE (CA1) ──────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/reproductive-releases', () => {
    const validInput = {
      animalId: 'animal-1',
      releaseDate: '2026-03-14',
      weightKg: 320,
      ageMonths: 24,
      bodyConditionScore: 3.5,
    };

    it('should create release and return 201', async () => {
      mockedService.createRelease.mockResolvedValue(SAMPLE_RELEASE);

      const res = await request(app)
        .post('/api/org/farms/farm-1/reproductive-releases')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('rel-1');
      expect(res.body.animalEarTag).toBe('001');
      expect(mockedService.createRelease).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when animal not found', async () => {
      mockedService.createRelease.mockRejectedValue(
        new ReproductiveReleaseError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/reproductive-releases')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Animal não encontrado');
    });

    it('should return 409 when animal already released', async () => {
      mockedService.createRelease.mockRejectedValue(
        new ReproductiveReleaseError('Animal 001 já foi liberado para reprodução', 409),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/reproductive-releases')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(409);
    });

    it('should return 400 for missing required fields', async () => {
      mockedService.createRelease.mockRejectedValue(
        new ReproductiveReleaseError('Data de liberação é obrigatória', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/reproductive-releases')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 when animal is male', async () => {
      mockedService.createRelease.mockRejectedValue(
        new ReproductiveReleaseError('Apenas fêmeas podem ser liberadas para reprodução', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/reproductive-releases')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(400);
    });

    it('should deny access to OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/reproductive-releases')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── BULK RELEASE (CA7) ────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/reproductive-releases/bulk', () => {
    const validBulkInput = {
      animalIds: ['animal-1', 'animal-2', 'animal-3'],
      releaseDate: '2026-03-14',
      targetLotId: 'lot-repro',
    };

    it('should bulk release and return 201', async () => {
      mockedService.bulkRelease.mockResolvedValue(SAMPLE_BULK_RESULT);

      const res = await request(app)
        .post('/api/org/farms/farm-1/reproductive-releases/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(201);
      expect(res.body.released).toBe(5);
      expect(res.body.failed).toBe(1);
      expect(res.body.errors).toHaveLength(1);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 when no animal IDs provided', async () => {
      mockedService.bulkRelease.mockRejectedValue(
        new ReproductiveReleaseError('Lista de animais é obrigatória', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/reproductive-releases/bulk')
        .set('Authorization', 'Bearer tok')
        .send({ animalIds: [], releaseDate: '2026-03-14' });

      expect(res.status).toBe(400);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/reproductive-releases/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST (CA8) ────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/reproductive-releases', () => {
    it('should list releases with pagination', async () => {
      mockedService.listReleases.mockResolvedValue({
        data: [SAMPLE_RELEASE],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/reproductive-releases')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by animalId', async () => {
      mockedService.listReleases.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/reproductive-releases?animalId=animal-1')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listReleases).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ animalId: 'animal-1' }),
      );
    });

    it('should filter by date range', async () => {
      mockedService.listReleases.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/reproductive-releases?dateFrom=2026-01-01&dateTo=2026-03-31')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listReleases).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ dateFrom: '2026-01-01', dateTo: '2026-03-31' }),
      );
    });
  });

  // ─── GET ────────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/reproductive-releases/:releaseId', () => {
    it('should return release by id', async () => {
      mockedService.getRelease.mockResolvedValue(SAMPLE_RELEASE);

      const res = await request(app)
        .get('/api/org/farms/farm-1/reproductive-releases/rel-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('rel-1');
      expect(res.body.previousCategory).toBe('BEZERRA');
    });

    it('should return 404 when not found', async () => {
      mockedService.getRelease.mockRejectedValue(
        new ReproductiveReleaseError('Registro de liberação não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/reproductive-releases/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── INDICATORS (CA9) ─────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/reproductive-releases/indicators', () => {
    it('should return release indicators', async () => {
      mockedService.getIndicators.mockResolvedValue(SAMPLE_INDICATORS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/reproductive-releases/indicators')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalReleased).toBe(10);
      expect(res.body.avgAgeMonths).toBe(22.5);
      expect(res.body.avgWeightKg).toBe(315.2);
      expect(res.body.avgRearingTimeDays).toBe(680);
    });

    it('should return nulls when no releases exist', async () => {
      mockedService.getIndicators.mockResolvedValue({
        totalReleased: 0,
        avgAgeMonths: null,
        avgWeightKg: null,
        avgRearingTimeDays: null,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/reproductive-releases/indicators')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalReleased).toBe(0);
      expect(res.body.avgAgeMonths).toBeNull();
    });
  });

  // ─── AUTH ─────────────────────────────────────────────────────────

  describe('Auth checks', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).get('/api/org/farms/farm-1/reproductive-releases');

      expect(res.status).toBe(401);
    });
  });
});
