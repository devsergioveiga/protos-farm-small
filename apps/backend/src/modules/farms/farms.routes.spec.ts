import request from 'supertest';
import { app } from '../../app';
import * as farmsService from './farms.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { FarmError } from './farms.types';

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

jest.mock('./farms.service', () => ({
  createFarm: jest.fn(),
  listFarms: jest.fn(),
  getFarm: jest.fn(),
  updateFarm: jest.fn(),
  toggleFarmStatus: jest.fn(),
  getFarmLimit: jest.fn(),
  addRegistration: jest.fn(),
  updateRegistration: jest.fn(),
  deleteRegistration: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

// Mock check-farm-access to always pass (we test permission logic, not farm access here)
jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(farmsService);
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

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

describe('Farms endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/org/farms');
      expect(response.status).toBe(401);
    });

    it('should return 403 for OPERATOR trying to create farm', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .post('/api/org/farms')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', state: 'SP', totalAreaHa: 100 });

      expect(response.status).toBe(403);
    });
  });

  // ─── POST /api/org/farms ───────────────────────────────────────

  describe('POST /api/org/farms', () => {
    const validBody = {
      name: 'Fazenda Teste',
      state: 'SP',
      totalAreaHa: 500,
    };

    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 201 on success', async () => {
      const created = { id: 'farm-new', ...validBody, status: 'ACTIVE' };
      mockedService.createFarm.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/farms')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('farm-new');
      expect(mockedService.createFarm).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'admin-1',
        expect.objectContaining({ name: 'Fazenda Teste', state: 'SP', totalAreaHa: 500 }),
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          action: 'CREATE_FARM',
          targetType: 'farm',
          targetId: 'farm-new',
        }),
      );
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/org/farms')
        .set('Authorization', 'Bearer valid-token')
        .send({ state: 'SP', totalAreaHa: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Nome é obrigatório');
      expect(mockedService.createFarm).not.toHaveBeenCalled();
    });

    it('should return 400 when state is missing', async () => {
      const response = await request(app)
        .post('/api/org/farms')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', totalAreaHa: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('UF é obrigatória');
    });

    it('should return 400 when totalAreaHa is zero', async () => {
      const response = await request(app)
        .post('/api/org/farms')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', state: 'SP', totalAreaHa: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Área total deve ser maior que zero');
    });

    it('should return 422 when farm limit reached', async () => {
      mockedService.createFarm.mockRejectedValue(new FarmError('Limite de fazendas atingido', 422));

      const response = await request(app)
        .post('/api/org/farms')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(422);
      expect(response.body.error).toBe('Limite de fazendas atingido');
    });

    it('should return 400 on invalid CIB', async () => {
      mockedService.createFarm.mockRejectedValue(
        new FarmError('Formato de CIB inválido. Esperado: XXX.XXX.XXX-X', 400),
      );

      const response = await request(app)
        .post('/api/org/farms')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validBody, cib: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('CIB');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.createFarm.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/org/farms')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── GET /api/org/farms ────────────────────────────────────────

  describe('GET /api/org/farms', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with paginated list', async () => {
      const result = {
        data: [{ id: 'farm-1', name: 'Fazenda 1' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listFarms.mockResolvedValue(result as never);

      const response = await request(app)
        .get('/api/org/farms')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.total).toBe(1);
    });

    it('should pass query params to service', async () => {
      mockedService.listFarms.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      } as never);

      await request(app)
        .get('/api/org/farms?page=2&limit=10&status=ACTIVE&state=SP&search=santa')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listFarms).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        {
          page: 2,
          limit: 10,
          search: 'santa',
          status: 'ACTIVE',
          state: 'SP',
        },
      );
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.listFarms.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/org/farms')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  // ─── GET /api/org/farms/:farmId ────────────────────────────────

  describe('GET /api/org/farms/:farmId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with farm details', async () => {
      const farm = { id: 'farm-1', name: 'Fazenda 1', registrations: [], userAccess: [] };
      mockedService.getFarm.mockResolvedValue(farm as never);

      const response = await request(app)
        .get('/api/org/farms/farm-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('farm-1');
      expect(mockedService.getFarm).toHaveBeenCalledWith({ organizationId: 'org-1' }, 'farm-1');
    });

    it('should return 404 when farm not found', async () => {
      mockedService.getFarm.mockRejectedValue(new FarmError('Fazenda não encontrada', 404));

      const response = await request(app)
        .get('/api/org/farms/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH /api/org/farms/:farmId ──────────────────────────────

  describe('PATCH /api/org/farms/:farmId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful update', async () => {
      const updated = { id: 'farm-1', name: 'Updated', registrations: [] };
      mockedService.updateFarm.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/farms/farm-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_FARM',
          targetId: 'farm-1',
          farmId: 'farm-1',
        }),
      );
    });

    it('should return 404 when farm not found', async () => {
      mockedService.updateFarm.mockRejectedValue(new FarmError('Fazenda não encontrada', 404));

      const response = await request(app)
        .patch('/api/org/farms/non-existent')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.updateFarm.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .patch('/api/org/farms/farm-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  // ─── PATCH /api/org/farms/:farmId/status ───────────────────────

  describe('PATCH /api/org/farms/:farmId/status', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on deactivate', async () => {
      const updated = { id: 'farm-1', status: 'INACTIVE' };
      mockedService.toggleFarmStatus.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/farms/farm-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('INACTIVE');
      expect(mockedService.toggleFarmStatus).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'INACTIVE',
      );
    });

    it('should return 400 when status is missing', async () => {
      const response = await request(app)
        .patch('/api/org/farms/farm-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Status deve ser ACTIVE ou INACTIVE');
      expect(mockedService.toggleFarmStatus).not.toHaveBeenCalled();
    });

    it('should return 400 when status is invalid', async () => {
      const response = await request(app)
        .patch('/api/org/farms/farm-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'SUSPENDED' });

      expect(response.status).toBe(400);
    });
  });

  // ─── GET /api/org/farms/limit ──────────────────────────────────

  describe('GET /api/org/farms/limit', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with limit at 40%', async () => {
      mockedService.getFarmLimit.mockResolvedValue({
        current: 2,
        max: 5,
        percentage: 40,
        warning: false,
        blocked: false,
      } as never);

      const response = await request(app)
        .get('/api/org/farms/limit')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.percentage).toBe(40);
      expect(response.body.warning).toBe(false);
      expect(response.body.blocked).toBe(false);
    });

    it('should return 200 with warning at 80%', async () => {
      mockedService.getFarmLimit.mockResolvedValue({
        current: 4,
        max: 5,
        percentage: 80,
        warning: true,
        blocked: false,
      } as never);

      const response = await request(app)
        .get('/api/org/farms/limit')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.warning).toBe(true);
    });

    it('should return 200 with blocked at 100%', async () => {
      mockedService.getFarmLimit.mockResolvedValue({
        current: 5,
        max: 5,
        percentage: 100,
        warning: true,
        blocked: true,
      } as never);

      const response = await request(app)
        .get('/api/org/farms/limit')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.blocked).toBe(true);
    });
  });

  // ─── POST /api/org/farms/:farmId/registrations ─────────────────

  describe('POST /api/org/farms/:farmId/registrations', () => {
    const validReg = {
      number: '12345',
      cartorioName: '1º Cartório de Sorriso',
      comarca: 'Sorriso',
      state: 'MT',
      areaHa: 2500,
    };

    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 201 on success', async () => {
      const created = { id: 'reg-1', ...validReg, farmId: 'farm-1', areaDivergence: null };
      mockedService.addRegistration.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/farms/farm-1/registrations')
        .set('Authorization', 'Bearer valid-token')
        .send(validReg);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('reg-1');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADD_FARM_REGISTRATION',
          targetType: 'farm_registration',
          farmId: 'farm-1',
        }),
      );
    });

    it('should return 201 with area divergence warning', async () => {
      const created = {
        id: 'reg-1',
        ...validReg,
        farmId: 'farm-1',
        areaDivergence: { divergent: true, percentage: 10.5 },
      };
      mockedService.addRegistration.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/farms/farm-1/registrations')
        .set('Authorization', 'Bearer valid-token')
        .send(validReg);

      expect(response.status).toBe(201);
      expect(response.body.areaDivergence.divergent).toBe(true);
      expect(response.body.areaDivergence.percentage).toBe(10.5);
    });

    it('should return 400 when number is missing', async () => {
      const response = await request(app)
        .post('/api/org/farms/farm-1/registrations')
        .set('Authorization', 'Bearer valid-token')
        .send({ cartorioName: 'X', comarca: 'Y', state: 'MT', areaHa: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Número da matrícula é obrigatório');
    });

    it('should return 400 when cartorioName is missing', async () => {
      const response = await request(app)
        .post('/api/org/farms/farm-1/registrations')
        .set('Authorization', 'Bearer valid-token')
        .send({ number: '123', comarca: 'Y', state: 'MT', areaHa: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Nome do cartório é obrigatório');
    });

    it('should return 400 when comarca is missing', async () => {
      const response = await request(app)
        .post('/api/org/farms/farm-1/registrations')
        .set('Authorization', 'Bearer valid-token')
        .send({ number: '123', cartorioName: 'X', state: 'MT', areaHa: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Comarca é obrigatória');
    });

    it('should return 400 when state is missing', async () => {
      const response = await request(app)
        .post('/api/org/farms/farm-1/registrations')
        .set('Authorization', 'Bearer valid-token')
        .send({ number: '123', cartorioName: 'X', comarca: 'Y', areaHa: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('UF da matrícula é obrigatória');
    });

    it('should return 400 when areaHa is zero', async () => {
      const response = await request(app)
        .post('/api/org/farms/farm-1/registrations')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validReg, areaHa: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Área da matrícula deve ser maior que zero');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.addRegistration.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/org/farms/farm-1/registrations')
        .set('Authorization', 'Bearer valid-token')
        .send(validReg);

      expect(response.status).toBe(500);
    });
  });

  // ─── PATCH /api/org/farms/:farmId/registrations/:regId ─────────

  describe('PATCH /api/org/farms/:farmId/registrations/:regId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful update', async () => {
      const updated = { id: 'reg-1', number: '99999', areaDivergence: null };
      mockedService.updateRegistration.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/farms/farm-1/registrations/reg-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ number: '99999' });

      expect(response.status).toBe(200);
      expect(response.body.number).toBe('99999');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_FARM_REGISTRATION',
          targetId: 'reg-1',
        }),
      );
    });

    it('should return 404 when registration not found', async () => {
      mockedService.updateRegistration.mockRejectedValue(
        new FarmError('Matrícula não encontrada', 404),
      );

      const response = await request(app)
        .patch('/api/org/farms/farm-1/registrations/non-existent')
        .set('Authorization', 'Bearer valid-token')
        .send({ number: '99999' });

      expect(response.status).toBe(404);
    });
  });

  // ─── DELETE /api/org/farms/:farmId/registrations/:regId ────────

  describe('DELETE /api/org/farms/:farmId/registrations/:regId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful delete', async () => {
      mockedService.deleteRegistration.mockResolvedValue({
        message: 'Matrícula removida com sucesso',
        areaDivergence: null,
      } as never);

      const response = await request(app)
        .delete('/api/org/farms/farm-1/registrations/reg-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Matrícula removida com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_FARM_REGISTRATION',
          targetId: 'reg-1',
        }),
      );
    });

    it('should return 404 when registration not found', async () => {
      mockedService.deleteRegistration.mockRejectedValue(
        new FarmError('Matrícula não encontrada', 404),
      );

      const response = await request(app)
        .delete('/api/org/farms/farm-1/registrations/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.deleteRegistration.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .delete('/api/org/farms/farm-1/registrations/reg-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });
});
