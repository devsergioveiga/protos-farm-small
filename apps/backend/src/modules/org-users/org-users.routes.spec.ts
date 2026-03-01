import request from 'supertest';
import { app } from '../../app';
import * as orgUsersService from './org-users.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { OrgUserError } from './org-users.types';

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

jest.mock('./org-users.service', () => ({
  createOrgUser: jest.fn(),
  listOrgUsers: jest.fn(),
  getOrgUser: jest.fn(),
  updateOrgUser: jest.fn(),
  toggleOrgUserStatus: jest.fn(),
  resetOrgUserPasswordByAdmin: jest.fn(),
  getOrgUserLimit: jest.fn(),
  resendInvite: jest.fn(),
  generateInviteLink: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(orgUsersService);
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
  // Set up RBAC permissions for checkPermission middleware
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

describe('Org Users endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/org/users');
      expect(response.status).toBe(401);
    });

    it('should return 403 with non-ADMIN role', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .get('/api/org/users')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });

  // ─── POST /api/org/users (CA1) ────────────────────────────────

  describe('POST /api/org/users', () => {
    const validBody = {
      name: 'Novo Usuário',
      email: 'novo@org.com',
      role: 'OPERATOR',
    };

    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 201 on success', async () => {
      const created = { id: 'user-new', ...validBody, status: 'ACTIVE' };
      mockedService.createOrgUser.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('user-new');
      expect(mockedService.createOrgUser).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        {
          name: 'Novo Usuário',
          email: 'novo@org.com',
          phone: undefined,
          role: 'OPERATOR',
          farmIds: undefined,
        },
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          action: 'CREATE_ORG_USER',
          targetType: 'user',
          targetId: 'user-new',
        }),
      );
    });

    it('should return 201 with farmIds', async () => {
      const body = { ...validBody, farmIds: ['farm-1', 'farm-2'] };
      const created = { id: 'user-new', ...body, status: 'ACTIVE' };
      mockedService.createOrgUser.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send(body);

      expect(response.status).toBe(201);
      expect(mockedService.createOrgUser).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({
          farmIds: ['farm-1', 'farm-2'],
        }),
      );
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'novo@org.com', role: 'OPERATOR' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Nome é obrigatório');
      expect(mockedService.createOrgUser).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Novo', role: 'OPERATOR' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email é obrigatório');
    });

    it('should return 400 when role is missing', async () => {
      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Novo', email: 'novo@org.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Role é obrigatória');
    });

    it('should return 400 when role is SUPER_ADMIN', async () => {
      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Novo', email: 'novo@org.com', role: 'SUPER_ADMIN' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Role inválida');
    });

    it('should return 400 when role is ADMIN', async () => {
      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Novo', email: 'novo@org.com', role: 'ADMIN' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Role inválida');
    });

    it('should return 400 when farmIds are invalid', async () => {
      mockedService.createOrgUser.mockRejectedValue(
        new OrgUserError('Uma ou mais fazendas não pertencem a esta organização', 400),
      );

      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validBody, farmIds: ['invalid-farm'] });

      expect(response.status).toBe(400);
    });

    it('should return 409 on duplicate email', async () => {
      mockedService.createOrgUser.mockRejectedValue(new OrgUserError('Email já cadastrado', 409));

      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email já cadastrado');
    });

    it('should return 422 when org is not active', async () => {
      mockedService.createOrgUser.mockRejectedValue(
        new OrgUserError('Organização não está ativa', 422),
      );

      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(422);
    });

    it('should return 422 when user limit reached', async () => {
      mockedService.createOrgUser.mockRejectedValue(
        new OrgUserError('Limite de usuários atingido', 422),
      );

      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(422);
      expect(response.body.error).toBe('Limite de usuários atingido');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.createOrgUser.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/org/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── GET /api/org/users (CA2) ─────────────────────────────────

  describe('GET /api/org/users', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with paginated list', async () => {
      const result = {
        data: [{ id: 'user-1', name: 'User 1' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listOrgUsers.mockResolvedValue(result as never);

      const response = await request(app)
        .get('/api/org/users')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.total).toBe(1);
      expect(mockedService.listOrgUsers).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        {
          page: undefined,
          limit: undefined,
          search: undefined,
          role: undefined,
          farmId: undefined,
          status: undefined,
        },
      );
    });

    it('should pass query params to service', async () => {
      mockedService.listOrgUsers.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      } as never);

      await request(app)
        .get('/api/org/users?page=2&limit=10&role=OPERATOR&status=ACTIVE&search=john&farmId=farm-1')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listOrgUsers).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        {
          page: 2,
          limit: 10,
          search: 'john',
          role: 'OPERATOR',
          farmId: 'farm-1',
          status: 'ACTIVE',
        },
      );
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.listOrgUsers.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/org/users')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  // ─── GET /api/org/users/:userId (CA2) ─────────────────────────

  describe('GET /api/org/users/:userId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with user details', async () => {
      const user = { id: 'user-1', name: 'User 1', farmAccess: [] };
      mockedService.getOrgUser.mockResolvedValue(user as never);

      const response = await request(app)
        .get('/api/org/users/user-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('user-1');
      expect(mockedService.getOrgUser).toHaveBeenCalledWith({ organizationId: 'org-1' }, 'user-1');
    });

    it('should return 404 when user not found', async () => {
      mockedService.getOrgUser.mockRejectedValue(
        new OrgUserError('Usuário não encontrado nesta organização', 404),
      );

      const response = await request(app)
        .get('/api/org/users/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.getOrgUser.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/org/users/user-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  // ─── PATCH /api/org/users/:userId (CA3) ───────────────────────

  describe('PATCH /api/org/users/:userId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful update', async () => {
      const updated = { id: 'user-1', name: 'Updated', role: 'MANAGER' };
      mockedService.updateOrgUser.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/users/user-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated', role: 'MANAGER' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated');
      expect(mockedService.updateOrgUser).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'user-1',
        'admin-1',
        {
          name: 'Updated',
          phone: undefined,
          role: 'MANAGER',
          farmIds: undefined,
        },
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_ORG_USER',
          targetId: 'user-1',
        }),
      );
    });

    it('should return 200 when updating farmIds', async () => {
      const updated = { id: 'user-1', name: 'User 1' };
      mockedService.updateOrgUser.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/users/user-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ farmIds: ['farm-1'] });

      expect(response.status).toBe(200);
    });

    it('should return 200 when clearing farmIds', async () => {
      const updated = { id: 'user-1', name: 'User 1' };
      mockedService.updateOrgUser.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/users/user-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ farmIds: [] });

      expect(response.status).toBe(200);
    });

    it('should return 422 on self-protection (role change)', async () => {
      mockedService.updateOrgUser.mockRejectedValue(
        new OrgUserError('Você não pode alterar sua própria role', 422),
      );

      const response = await request(app)
        .patch('/api/org/users/admin-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ role: 'OPERATOR' });

      expect(response.status).toBe(422);
      expect(response.body.error).toBe('Você não pode alterar sua própria role');
    });

    it('should return 400 on invalid role', async () => {
      mockedService.updateOrgUser.mockRejectedValue(
        new OrgUserError(
          'Role inválida. Roles permitidas: MANAGER, AGRONOMIST, FINANCIAL, OPERATOR, COWBOY, CONSULTANT',
          400,
        ),
      );

      const response = await request(app)
        .patch('/api/org/users/user-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ role: 'SUPER_ADMIN' });

      expect(response.status).toBe(400);
    });

    it('should return 404 when user not found', async () => {
      mockedService.updateOrgUser.mockRejectedValue(
        new OrgUserError('Usuário não encontrado nesta organização', 404),
      );

      const response = await request(app)
        .patch('/api/org/users/non-existent')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.updateOrgUser.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .patch('/api/org/users/user-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  // ─── PATCH /api/org/users/:userId/status (CA4) ────────────────

  describe('PATCH /api/org/users/:userId/status', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on deactivate', async () => {
      const updated = { id: 'user-1', status: 'INACTIVE' };
      mockedService.toggleOrgUserStatus.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/users/user-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('INACTIVE');
      expect(mockedService.toggleOrgUserStatus).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'user-1',
        'admin-1',
        'INACTIVE',
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_ORG_USER_STATUS',
          metadata: { status: 'INACTIVE' },
        }),
      );
    });

    it('should return 200 on reactivate', async () => {
      const updated = { id: 'user-1', status: 'ACTIVE' };
      mockedService.toggleOrgUserStatus.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/users/user-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'ACTIVE' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACTIVE');
    });

    it('should return 400 when status is missing', async () => {
      const response = await request(app)
        .patch('/api/org/users/user-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Status deve ser ACTIVE ou INACTIVE');
      expect(mockedService.toggleOrgUserStatus).not.toHaveBeenCalled();
    });

    it('should return 400 when status is invalid', async () => {
      const response = await request(app)
        .patch('/api/org/users/user-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'SUSPENDED' });

      expect(response.status).toBe(400);
      expect(mockedService.toggleOrgUserStatus).not.toHaveBeenCalled();
    });

    it('should return 422 on self-deactivation', async () => {
      mockedService.toggleOrgUserStatus.mockRejectedValue(
        new OrgUserError('Você não pode desativar sua própria conta', 422),
      );

      const response = await request(app)
        .patch('/api/org/users/admin-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(422);
      expect(response.body.error).toBe('Você não pode desativar sua própria conta');
    });

    it('should return 404 when user not found', async () => {
      mockedService.toggleOrgUserStatus.mockRejectedValue(
        new OrgUserError('Usuário não encontrado nesta organização', 404),
      );

      const response = await request(app)
        .patch('/api/org/users/non-existent/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.toggleOrgUserStatus.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .patch('/api/org/users/user-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(500);
    });
  });

  // ─── POST /api/org/users/:userId/reset-password (CA4) ─────────

  describe('POST /api/org/users/:userId/reset-password', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on success', async () => {
      mockedService.resetOrgUserPasswordByAdmin.mockResolvedValue({
        message: 'Email de redefinição de senha enviado',
      } as never);

      const response = await request(app)
        .post('/api/org/users/user-1/reset-password')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email de redefinição de senha enviado');
      expect(mockedService.resetOrgUserPasswordByAdmin).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'user-1',
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESET_ORG_USER_PASSWORD',
          targetId: 'user-1',
        }),
      );
    });

    it('should return 404 when user not found', async () => {
      mockedService.resetOrgUserPasswordByAdmin.mockRejectedValue(
        new OrgUserError('Usuário não encontrado nesta organização', 404),
      );

      const response = await request(app)
        .post('/api/org/users/non-existent/reset-password')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.resetOrgUserPasswordByAdmin.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/org/users/user-1/reset-password')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  // ─── GET /api/org/users/limit (CA5) ───────────────────────────

  describe('GET /api/org/users/limit', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with limit at 50%', async () => {
      mockedService.getOrgUserLimit.mockResolvedValue({
        current: 5,
        max: 10,
        percentage: 50,
        warning: false,
        blocked: false,
      } as never);

      const response = await request(app)
        .get('/api/org/users/limit')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.percentage).toBe(50);
      expect(response.body.warning).toBe(false);
      expect(response.body.blocked).toBe(false);
    });

    it('should return 200 with warning at 80%', async () => {
      mockedService.getOrgUserLimit.mockResolvedValue({
        current: 8,
        max: 10,
        percentage: 80,
        warning: true,
        blocked: false,
      } as never);

      const response = await request(app)
        .get('/api/org/users/limit')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.warning).toBe(true);
      expect(response.body.blocked).toBe(false);
    });

    it('should return 200 with blocked at 100%', async () => {
      mockedService.getOrgUserLimit.mockResolvedValue({
        current: 10,
        max: 10,
        percentage: 100,
        warning: true,
        blocked: true,
      } as never);

      const response = await request(app)
        .get('/api/org/users/limit')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.blocked).toBe(true);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.getOrgUserLimit.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/org/users/limit')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  // ─── POST /api/org/users/:userId/resend-invite (CA5) ──────────

  describe('POST /api/org/users/:userId/resend-invite', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on success', async () => {
      mockedService.resendInvite.mockResolvedValue({
        message: 'Convite reenviado com sucesso',
        inviteUrl: 'http://localhost:5173/accept-invite?token=abc',
      } as never);

      const response = await request(app)
        .post('/api/org/users/user-1/resend-invite')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Convite reenviado com sucesso');
      expect(response.body.inviteUrl).toBeDefined();
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESEND_ORG_USER_INVITE',
          targetId: 'user-1',
        }),
      );
    });

    it('should return 422 when user already has password', async () => {
      mockedService.resendInvite.mockRejectedValue(
        new OrgUserError('Usuário já definiu sua senha', 422),
      );

      const response = await request(app)
        .post('/api/org/users/user-1/resend-invite')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(422);
      expect(response.body.error).toBe('Usuário já definiu sua senha');
    });

    it('should return 404 when user not found', async () => {
      mockedService.resendInvite.mockRejectedValue(
        new OrgUserError('Usuário não encontrado nesta organização', 404),
      );

      const response = await request(app)
        .post('/api/org/users/non-existent/resend-invite')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.resendInvite.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/org/users/user-1/resend-invite')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  // ─── POST /api/org/users/:userId/invite-link (CA5) ────────────

  describe('POST /api/org/users/:userId/invite-link', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with invite URL', async () => {
      mockedService.generateInviteLink.mockResolvedValue({
        inviteUrl: 'http://localhost:5173/accept-invite?token=abc',
      } as never);

      const response = await request(app)
        .post('/api/org/users/user-1/invite-link')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.inviteUrl).toBeDefined();
    });

    it('should return 422 when user already has password', async () => {
      mockedService.generateInviteLink.mockRejectedValue(
        new OrgUserError('Usuário já definiu sua senha', 422),
      );

      const response = await request(app)
        .post('/api/org/users/user-1/invite-link')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(422);
    });

    it('should return 404 when user not found', async () => {
      mockedService.generateInviteLink.mockRejectedValue(
        new OrgUserError('Usuário não encontrado nesta organização', 404),
      );

      const response = await request(app)
        .post('/api/org/users/non-existent/invite-link')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.generateInviteLink.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/org/users/user-1/invite-link')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });
});
