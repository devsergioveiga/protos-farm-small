import request from 'supertest';
import { app } from '../../app';
import * as pestsService from './pests.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { PestError } from './pests.types';

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

jest.mock('./pests.service', () => ({
  createPest: jest.fn(),
  listPests: jest.fn(),
  getPest: jest.fn(),
  updatePest: jest.fn(),
  deletePest: jest.fn(),
  listCategories: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(pestsService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const SAMPLE_PEST = {
  id: 'pest-1',
  organizationId: 'org-1',
  commonName: 'Lagarta-do-cartucho',
  scientificName: 'Spodoptera frugiperda',
  category: 'INSETO',
  categoryLabel: 'Inseto',
  affectedCrops: ['milho', 'soja'],
  severity: 'ALTO',
  severityLabel: 'Alto',
  ndeDescription: '20% folhas raspadas',
  ncDescription: '2 lagartas por planta',
  lifecycle: 'Ovo → Larva (6 instares) → Pupa → Adulto',
  symptoms: 'Folhas com aspecto de raspagem, presença de excremento',
  photoUrl: null,
  notes: null,
  createdAt: '2026-03-09T00:00:00.000Z',
  updatedAt: '2026-03-09T00:00:00.000Z',
};

describe('Pests routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── GET /org/pests/categories ───────────────────────────────────

  describe('GET /api/org/pests/categories', () => {
    it('returns pest categories', async () => {
      const categories = [
        { value: 'INSETO', label: 'Inseto' },
        { value: 'FUNGO', label: 'Fungo' },
      ];
      mockedService.listCategories.mockReturnValue(categories);

      const res = await request(app)
        .get('/api/org/pests/categories')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(categories);
    });
  });

  // ─── POST /org/pests ─────────────────────────────────────────────

  describe('POST /api/org/pests', () => {
    it('creates a pest and returns 201', async () => {
      mockedService.createPest.mockResolvedValue(SAMPLE_PEST);

      const res = await request(app)
        .post('/api/org/pests')
        .set('Authorization', 'Bearer token')
        .send({
          commonName: 'Lagarta-do-cartucho',
          scientificName: 'Spodoptera frugiperda',
          category: 'INSETO',
          affectedCrops: ['milho', 'soja'],
        });

      expect(res.status).toBe(201);
      expect(res.body.commonName).toBe('Lagarta-do-cartucho');
      expect(mockedService.createPest).toHaveBeenCalledTimes(1);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_PEST', targetType: 'pest' }),
      );
    });

    it('returns 409 for duplicate name', async () => {
      mockedService.createPest.mockRejectedValue(
        new PestError('Já existe uma praga/doença com esse nome', 409),
      );

      const res = await request(app)
        .post('/api/org/pests')
        .set('Authorization', 'Bearer token')
        .send({ commonName: 'Lagarta-do-cartucho', category: 'INSETO' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Já existe/);
    });

    it('returns 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app)
        .post('/api/org/pests')
        .send({ commonName: 'Test', category: 'INSETO' });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /org/pests ──────────────────────────────────────────────

  describe('GET /api/org/pests', () => {
    it('lists pests with pagination', async () => {
      mockedService.listPests.mockResolvedValue({
        data: [SAMPLE_PEST],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app).get('/api/org/pests').set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('passes query filters to service', async () => {
      mockedService.listPests.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/org/pests?category=FUNGO&crop=soja&search=ferrugem')
        .set('Authorization', 'Bearer token');

      expect(mockedService.listPests).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ category: 'FUNGO', crop: 'soja', search: 'ferrugem' }),
      );
    });
  });

  // ─── GET /org/pests/:pestId ──────────────────────────────────────

  describe('GET /api/org/pests/:pestId', () => {
    it('returns pest detail', async () => {
      mockedService.getPest.mockResolvedValue(SAMPLE_PEST);

      const res = await request(app)
        .get('/api/org/pests/pest-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('pest-1');
    });

    it('returns 404 for non-existent pest', async () => {
      mockedService.getPest.mockRejectedValue(new PestError('Praga/doença não encontrada', 404));

      const res = await request(app)
        .get('/api/org/pests/non-existent')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /org/pests/:pestId ────────────────────────────────────

  describe('PATCH /api/org/pests/:pestId', () => {
    it('updates pest and returns updated data', async () => {
      const updated = { ...SAMPLE_PEST, commonName: 'Lagarta-militar' };
      mockedService.updatePest.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/pests/pest-1')
        .set('Authorization', 'Bearer token')
        .send({ commonName: 'Lagarta-militar' });

      expect(res.status).toBe(200);
      expect(res.body.commonName).toBe('Lagarta-militar');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_PEST' }),
      );
    });
  });

  // ─── DELETE /org/pests/:pestId ───────────────────────────────────

  describe('DELETE /api/org/pests/:pestId', () => {
    it('soft-deletes pest and returns 204', async () => {
      mockedService.deletePest.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/pests/pest-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_PEST', targetId: 'pest-1' }),
      );
    });

    it('returns 404 for non-existent pest', async () => {
      mockedService.deletePest.mockRejectedValue(new PestError('Praga/doença não encontrada', 404));

      const res = await request(app)
        .delete('/api/org/pests/non-existent')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── Error handling ──────────────────────────────────────────────

  describe('Error handling', () => {
    it('returns 500 for unexpected errors', async () => {
      mockedService.createPest.mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app)
        .post('/api/org/pests')
        .set('Authorization', 'Bearer token')
        .send({ commonName: 'Test', category: 'INSETO' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });
  });
});
