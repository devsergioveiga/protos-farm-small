import request from 'supertest';
import { app } from '../../app';
import * as rolesService from './roles.service';
import * as authService from '../auth/auth.service';

jest.mock('./roles.service', () => ({
  createCustomRole: jest.fn(),
  listCustomRoles: jest.fn(),
  getCustomRole: jest.fn(),
  updateCustomRole: jest.fn(),
  deleteCustomRole: jest.fn(),
}));

jest.mock('../../shared/audit/audit.service', () => ({
  logAudit: jest.fn(),
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

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(rolesService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@test.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

describe('Roles endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/org/roles');
      expect(res.status).toBe(401);
    });

    it('should return 403 for OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);
      const res = await request(app)
        .get('/api/org/roles')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(403);
    });
  });

  // ─── POST /api/org/roles ────────────────────────────────────────

  describe('POST /api/org/roles', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 400 without name', async () => {
      const res = await request(app)
        .post('/api/org/roles')
        .set('Authorization', 'Bearer valid-token')
        .send({ baseRole: 'MANAGER' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Nome é obrigatório');
    });

    it('should return 400 without baseRole', async () => {
      const res = await request(app)
        .post('/api/org/roles')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Custom Manager' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Papel base é obrigatório');
    });

    it('should return 201 on success', async () => {
      const role = {
        id: 'role-1',
        name: 'Custom Manager',
        baseRole: 'MANAGER',
        organizationId: 'org-1',
        permissions: [],
      };
      mockedService.createCustomRole.mockResolvedValue(role as never);

      const res = await request(app)
        .post('/api/org/roles')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Custom Manager', baseRole: 'MANAGER' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Custom Manager');
      expect(mockedService.createCustomRole).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        {
          name: 'Custom Manager',
          baseRole: 'MANAGER',
          description: undefined,
          overrides: undefined,
        },
      );
    });

    it('should return 409 on duplicate name', async () => {
      const { RoleError } = jest.requireActual('./roles.types') as typeof import('./roles.types');
      mockedService.createCustomRole.mockRejectedValue(
        new RoleError('Já existe um papel customizado com esse nome nesta organização', 409),
      );

      const res = await request(app)
        .post('/api/org/roles')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Custom Manager', baseRole: 'MANAGER' });

      expect(res.status).toBe(409);
    });
  });

  // ─── GET /api/org/roles ─────────────────────────────────────────

  describe('GET /api/org/roles', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with roles list', async () => {
      mockedService.listCustomRoles.mockResolvedValue([
        { id: 'role-1', name: 'Custom A', baseRole: 'MANAGER' },
      ] as never);

      const res = await request(app)
        .get('/api/org/roles')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  // ─── GET /api/org/roles/:roleId ────────────────────────────────

  describe('GET /api/org/roles/:roleId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with role detail', async () => {
      mockedService.getCustomRole.mockResolvedValue({
        id: 'role-1',
        name: 'Custom Manager',
        permissions: [],
      } as never);

      const res = await request(app)
        .get('/api/org/roles/role-1')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('role-1');
    });

    it('should return 404 when not found', async () => {
      const { RoleError } = jest.requireActual('./roles.types') as typeof import('./roles.types');
      mockedService.getCustomRole.mockRejectedValue(
        new RoleError('Papel customizado não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/roles/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/org/roles/:roleId ──────────────────────────────

  describe('PATCH /api/org/roles/:roleId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on success', async () => {
      mockedService.updateCustomRole.mockResolvedValue({
        id: 'role-1',
        name: 'Updated Name',
        permissions: [],
      } as never);

      const res = await request(app)
        .patch('/api/org/roles/role-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
    });
  });

  // ─── DELETE /api/org/roles/:roleId ─────────────────────────────

  describe('DELETE /api/org/roles/:roleId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on soft-delete', async () => {
      mockedService.deleteCustomRole.mockResolvedValue({
        message: 'Papel customizado desativado com sucesso',
      });

      const res = await request(app)
        .delete('/api/org/roles/role-1')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('desativado');
    });

    it('should return 404 when not found', async () => {
      const { RoleError } = jest.requireActual('./roles.types') as typeof import('./roles.types');
      mockedService.deleteCustomRole.mockRejectedValue(
        new RoleError('Papel customizado não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/roles/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });
});
