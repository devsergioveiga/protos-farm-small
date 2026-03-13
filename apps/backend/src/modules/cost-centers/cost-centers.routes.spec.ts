import request from 'supertest';
import { app } from '../../app';
import * as costCenterService from './cost-centers.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { CostCenterError } from './cost-centers.types';

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

jest.mock('./cost-centers.service', () => ({
  createCostCenter: jest.fn(),
  listCostCenters: jest.fn(),
  getCostCenter: jest.fn(),
  updateCostCenter: jest.fn(),
  deleteCostCenter: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(costCenterService);
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

const FARM_ID = 'farm-1';
const CC_ID = 'cc-1';

const SAMPLE_CC = {
  id: CC_ID,
  farmId: FARM_ID,
  code: 'CC-001',
  name: 'Lavoura Norte',
  description: 'Centro de custo da lavoura norte',
  isActive: true,
  teamCount: 0,
  createdAt: '2026-03-13T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
};

describe('Cost Centers Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST', () => {
    it('creates a cost center', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createCostCenter.mockResolvedValue(SAMPLE_CC);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/cost-centers`)
        .set('Authorization', 'Bearer valid-token')
        .send({ code: 'CC-001', name: 'Lavoura Norte' });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('CC-001');
      expect(res.body.name).toBe('Lavoura Norte');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_COST_CENTER' }),
      );
    });

    it('returns 400 for missing code', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createCostCenter.mockRejectedValue(
        new CostCenterError('Código é obrigatório', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/cost-centers`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate code', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createCostCenter.mockRejectedValue(
        new CostCenterError('Já existe um centro de custo com este código nesta fazenda', 409),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/cost-centers`)
        .set('Authorization', 'Bearer valid-token')
        .send({ code: 'CC-001', name: 'Duplicado' });

      expect(res.status).toBe(409);
    });

    it('rejects OPERATOR (no farms:update)', async () => {
      authAs({
        userId: 'v1',
        email: 'v@org.com',
        role: 'OPERATOR' as const,
        organizationId: 'org-1',
      });

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/cost-centers`)
        .set('Authorization', 'Bearer valid-token')
        .send({ code: 'CC-001', name: 'Test' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET list', () => {
    it('lists cost centers', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listCostCenters.mockResolvedValue([SAMPLE_CC]);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cost-centers`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].code).toBe('CC-001');
    });

    it('passes activeOnly filter', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listCostCenters.mockResolvedValue([SAMPLE_CC]);

      await request(app)
        .get(`/api/org/farms/${FARM_ID}/cost-centers?activeOnly=true`)
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listCostCenters).toHaveBeenCalledWith(expect.any(Object), FARM_ID, {
        activeOnly: true,
      });
    });
  });

  describe('GET by ID', () => {
    it('returns a cost center', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getCostCenter.mockResolvedValue(SAMPLE_CC);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cost-centers/${CC_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Lavoura Norte');
    });

    it('returns 404', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getCostCenter.mockRejectedValue(
        new CostCenterError('Centro de custo não encontrado', 404),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cost-centers/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH', () => {
    it('updates a cost center', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.updateCostCenter.mockResolvedValue({ ...SAMPLE_CC, name: 'Lavoura Sul' });

      const res = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/cost-centers/${CC_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Lavoura Sul' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Lavoura Sul');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_COST_CENTER' }),
      );
    });

    it('can deactivate a cost center', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.updateCostCenter.mockResolvedValue({ ...SAMPLE_CC, isActive: false });

      const res = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/cost-centers/${CC_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  describe('DELETE', () => {
    it('deletes a cost center', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteCostCenter.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/cost-centers/${CC_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_COST_CENTER' }),
      );
    });

    it('returns 409 when cost center has teams', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteCostCenter.mockRejectedValue(
        new CostCenterError(
          'Não é possível excluir: existem equipes vinculadas a este centro de custo',
          409,
        ),
      );

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/cost-centers/${CC_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(409);
    });
  });

  describe('Error handling', () => {
    it('returns 500 for unexpected errors', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listCostCenters.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/cost-centers`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
    });
  });
});
