import request from 'supertest';
import { app } from '../../app';
import * as ptService from './productivity-targets.service';
import * as authService from '../auth/auth.service';
import { ProductivityTargetError } from './productivity-targets.types';

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

jest.mock('./productivity-targets.service', () => ({
  listProductivityTargets: jest.fn(),
  createProductivityTarget: jest.fn(),
  updateProductivityTarget: jest.fn(),
  deleteProductivityTarget: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(ptService);
const mockedAuth = jest.mocked(authService);

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

const SAMPLE_TARGET = {
  id: 'target-1',
  farmId: FARM_ID,
  operationType: 'COLHEITA',
  operationTypeLabel: 'Colheita',
  targetValue: 200,
  targetUnit: 'litros',
  period: 'day',
  ratePerUnit: 0.5,
  rateUnit: 'litros',
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
};

describe('Productivity Targets Routes (US-079 CA3)', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET list', () => {
    it('returns all targets for a farm', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listProductivityTargets.mockResolvedValue([SAMPLE_TARGET]);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/productivity-targets`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].targetValue).toBe(200);
      expect(res.body[0].targetUnit).toBe('litros');
    });
  });

  describe('POST create', () => {
    it('creates a productivity target', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createProductivityTarget.mockResolvedValue(SAMPLE_TARGET);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/productivity-targets`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          operationType: 'COLHEITA',
          targetValue: 200,
          targetUnit: 'litros',
          ratePerUnit: 0.5,
          rateUnit: 'litros',
        });

      expect(res.status).toBe(201);
      expect(res.body.operationTypeLabel).toBe('Colheita');
    });

    it('returns 400 for invalid input', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createProductivityTarget.mockRejectedValue(
        new ProductivityTargetError('Meta de produtividade deve ser maior que zero', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/productivity-targets`)
        .set('Authorization', 'Bearer valid-token')
        .send({ operationType: 'COLHEITA', targetValue: -1, targetUnit: 'kg' });

      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createProductivityTarget.mockRejectedValue(
        new ProductivityTargetError('Já existe uma meta para esse tipo de operação e unidade', 409),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/productivity-targets`)
        .set('Authorization', 'Bearer valid-token')
        .send({ operationType: 'COLHEITA', targetValue: 200, targetUnit: 'litros' });

      expect(res.status).toBe(409);
    });
  });

  describe('PUT update', () => {
    it('updates target value', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.updateProductivityTarget.mockResolvedValue({
        ...SAMPLE_TARGET,
        targetValue: 300,
      });

      const res = await request(app)
        .put(`/api/org/farms/${FARM_ID}/productivity-targets/target-1`)
        .set('Authorization', 'Bearer valid-token')
        .send({ targetValue: 300 });

      expect(res.status).toBe(200);
      expect(res.body.targetValue).toBe(300);
    });
  });

  describe('DELETE', () => {
    it('deletes a target', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteProductivityTarget.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/productivity-targets/target-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
    });

    it('returns 404 for not found', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteProductivityTarget.mockRejectedValue(
        new ProductivityTargetError('Meta não encontrada', 404),
      );

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/productivity-targets/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });
});
