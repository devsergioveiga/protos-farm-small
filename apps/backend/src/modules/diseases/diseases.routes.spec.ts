import request from 'supertest';
import { app } from '../../app';
import * as diseasesService from './diseases.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { DiseaseError } from './diseases.types';

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

jest.mock('./diseases.service', () => ({
  createDisease: jest.fn(),
  listDiseases: jest.fn(),
  getDisease: jest.fn(),
  updateDisease: jest.fn(),
  deleteDisease: jest.fn(),
  listCategories: jest.fn(),
  listSeverityLevels: jest.fn(),
  listAffectedSystems: jest.fn(),
  SEED_DISEASES: [
    { name: 'Mastite clínica', category: 'INFECTIOUS', severity: 'MODERATE' },
    { name: 'Pneumonia', category: 'INFECTIOUS', severity: 'SEVERE' },
  ],
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(diseasesService);
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

const SAMPLE_DISEASE = {
  id: 'disease-1',
  organizationId: 'org-1',
  name: 'Mastite clínica',
  scientificName: null,
  code: null,
  category: 'INFECTIOUS',
  categoryLabel: 'Infecciosa',
  severity: 'MODERATE',
  severityLabel: 'Moderada',
  affectedSystem: 'MAMMARY',
  affectedSystemLabel: 'Mamário',
  symptoms: 'Leite alterado, úbere inchado',
  quarantineDays: null,
  isNotifiable: false,
  photoUrl: null,
  notes: null,
  createdAt: '2026-03-13T00:00:00.000Z',
  updatedAt: '2026-03-13T00:00:00.000Z',
};

describe('Diseases routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CATEGORIES ────────────────────────────────────────────────────

  describe('GET /api/org/diseases/categories', () => {
    it('should return categories list', async () => {
      const cats = [
        { value: 'INFECTIOUS', label: 'Infecciosa' },
        { value: 'METABOLIC', label: 'Metabólica' },
      ];
      mockedService.listCategories.mockReturnValue(cats);

      const res = await request(app)
        .get('/api/org/diseases/categories')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(cats);
    });
  });

  // ─── SEVERITY LEVELS ──────────────────────────────────────────────

  describe('GET /api/org/diseases/severity-levels', () => {
    it('should return severity levels', async () => {
      const levels = [
        { value: 'MILD', label: 'Leve' },
        { value: 'MODERATE', label: 'Moderada' },
        { value: 'SEVERE', label: 'Grave' },
      ];
      mockedService.listSeverityLevels.mockReturnValue(levels);

      const res = await request(app)
        .get('/api/org/diseases/severity-levels')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(levels);
    });
  });

  // ─── AFFECTED SYSTEMS ─────────────────────────────────────────────

  describe('GET /api/org/diseases/affected-systems', () => {
    it('should return affected systems', async () => {
      const systems = [
        { value: 'DIGESTIVE', label: 'Digestivo' },
        { value: 'MAMMARY', label: 'Mamário' },
      ];
      mockedService.listAffectedSystems.mockReturnValue(systems);

      const res = await request(app)
        .get('/api/org/diseases/affected-systems')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(systems);
    });
  });

  // ─── CREATE ────────────────────────────────────────────────────────

  describe('POST /api/org/diseases', () => {
    it('should create a disease and return 201', async () => {
      mockedService.createDisease.mockResolvedValue(SAMPLE_DISEASE);

      const res = await request(app)
        .post('/api/org/diseases')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Mastite clínica', category: 'INFECTIOUS' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Mastite clínica');
      expect(mockedService.createDisease).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        { name: 'Mastite clínica', category: 'INFECTIOUS' },
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_DISEASE',
          targetType: 'disease',
          targetId: 'disease-1',
        }),
      );
    });

    it('should return 409 for duplicate name', async () => {
      mockedService.createDisease.mockRejectedValue(
        new DiseaseError('Já existe uma doença com esse nome', 409),
      );

      const res = await request(app)
        .post('/api/org/diseases')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Mastite clínica', category: 'INFECTIOUS' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Já existe');
    });

    it('should return 400 for missing name', async () => {
      mockedService.createDisease.mockRejectedValue(
        new DiseaseError('Nome da doença é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/diseases')
        .set('Authorization', 'Bearer tok')
        .send({ category: 'INFECTIOUS' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid category', async () => {
      mockedService.createDisease.mockRejectedValue(
        new DiseaseError('Categoria inválida. Use: INFECTIOUS, METABOLIC, ...', 400),
      );

      const res = await request(app)
        .post('/api/org/diseases')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Test', category: 'INVALID' });

      expect(res.status).toBe(400);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET /api/org/diseases', () => {
    it('should return paginated list', async () => {
      const result = {
        data: [SAMPLE_DISEASE],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listDiseases.mockResolvedValue(result);

      const res = await request(app).get('/api/org/diseases').set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should pass query filters', async () => {
      mockedService.listDiseases.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/org/diseases?category=METABOLIC&severity=SEVERE&search=cetose&isNotifiable=true')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listDiseases).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({
          category: 'METABOLIC',
          severity: 'SEVERE',
          search: 'cetose',
          isNotifiable: true,
        }),
      );
    });

    it('should pass pagination params', async () => {
      mockedService.listDiseases.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 15, totalPages: 2 },
      });

      await request(app)
        .get('/api/org/diseases?page=2&limit=10')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listDiseases).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET /api/org/diseases/:diseaseId', () => {
    it('should return a disease by id', async () => {
      mockedService.getDisease.mockResolvedValue(SAMPLE_DISEASE);

      const res = await request(app)
        .get('/api/org/diseases/disease-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('disease-1');
    });

    it('should return 404 for non-existing disease', async () => {
      mockedService.getDisease.mockRejectedValue(new DiseaseError('Doença não encontrada', 404));

      const res = await request(app)
        .get('/api/org/diseases/nonexistent')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('PATCH /api/org/diseases/:diseaseId', () => {
    it('should update a disease', async () => {
      const updated = { ...SAMPLE_DISEASE, name: 'Mastite clínica atualizada' };
      mockedService.updateDisease.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/diseases/disease-1')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Mastite clínica atualizada' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Mastite clínica atualizada');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_DISEASE',
          targetId: 'disease-1',
        }),
      );
    });

    it('should return 404 when updating non-existing', async () => {
      mockedService.updateDisease.mockRejectedValue(new DiseaseError('Doença não encontrada', 404));

      const res = await request(app)
        .patch('/api/org/diseases/nonexistent')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should return 409 for duplicate name on update', async () => {
      mockedService.updateDisease.mockRejectedValue(
        new DiseaseError('Já existe uma doença com esse nome', 409),
      );

      const res = await request(app)
        .patch('/api/org/diseases/disease-1')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Pneumonia' });

      expect(res.status).toBe(409);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /api/org/diseases/:diseaseId', () => {
    it('should soft delete and return 204', async () => {
      mockedService.deleteDisease.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/diseases/disease-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_DISEASE',
          targetId: 'disease-1',
        }),
      );
    });

    it('should return 404 when deleting non-existing', async () => {
      mockedService.deleteDisease.mockRejectedValue(new DiseaseError('Doença não encontrada', 404));

      const res = await request(app)
        .delete('/api/org/diseases/nonexistent')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── SEED ─────────────────────────────────────────────────────────

  describe('POST /api/org/diseases/seed', () => {
    it('should seed diseases and return count', async () => {
      mockedService.createDisease
        .mockResolvedValueOnce({ ...SAMPLE_DISEASE, id: 'd1', name: 'Mastite clínica' })
        .mockResolvedValueOnce({ ...SAMPLE_DISEASE, id: 'd2', name: 'Pneumonia' });

      const res = await request(app)
        .post('/api/org/diseases/seed')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(2);
      expect(res.body.total).toBe(2);
    });

    it('should skip duplicates during seed', async () => {
      mockedService.createDisease
        .mockResolvedValueOnce({ ...SAMPLE_DISEASE, id: 'd1' })
        .mockRejectedValueOnce(new DiseaseError('Já existe', 409));

      const res = await request(app)
        .post('/api/org/diseases/seed')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(1);
    });
  });

  // ─── AUTH ─────────────────────────────────────────────────────────

  describe('Authentication & Authorization', () => {
    it('should return 401 without token', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).get('/api/org/diseases');

      expect(res.status).toBe(401);
    });

    it('should allow OPERATOR to read diseases', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.listDiseases.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app).get('/api/org/diseases').set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
    });
  });
});
