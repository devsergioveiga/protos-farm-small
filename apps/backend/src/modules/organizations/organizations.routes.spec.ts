import request from 'supertest';
import { app } from '../../app';
import * as orgService from './organizations.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';

jest.mock('../../shared/audit/audit.service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./organizations.service', () => {
  const actual = jest.requireActual('./organizations.service');
  return {
    ...actual,
    createOrganization: jest.fn(),
    listOrganizations: jest.fn(),
    getOrganizationById: jest.fn(),
    updateOrganizationStatus: jest.fn(),
    updateOrganizationPlan: jest.fn(),
    updateSessionPolicy: jest.fn(),
    createOrgAdmin: jest.fn(),
    resetOrgUserPassword: jest.fn(),
    unlockOrgUser: jest.fn(),
  };
});

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(orgService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const SUPER_ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@test.com',
  role: 'SUPER_ADMIN' as const,
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
}

describe('Organizations endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/admin/organizations');
      expect(response.status).toBe(401);
    });

    it('should return 403 with non-SUPER_ADMIN role', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .get('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });

  // ─── POST /api/admin/organizations ──────────────────────────────

  describe('POST /api/admin/organizations', () => {
    const validBody = {
      name: 'Nova Org',
      type: 'PJ',
      document: '11.222.333/0001-81',
      plan: 'basic',
    };

    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 201 on success', async () => {
      const created = { id: 'org-new', ...validBody, document: '11222333000181', status: 'ACTIVE' };
      mockedService.createOrganization.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('org-new');
      expect(mockedService.createOrganization).toHaveBeenCalledWith({
        name: 'Nova Org',
        type: 'PJ',
        document: '11.222.333/0001-81',
        plan: 'basic',
        maxUsers: undefined,
        maxFarms: undefined,
      });
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          action: 'CREATE_ORGANIZATION',
          targetType: 'organization',
          targetId: 'org-new',
        }),
      );
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'PJ', document: '11222333000181' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.createOrganization).not.toHaveBeenCalled();
    });

    it('should return 400 when type is invalid', async () => {
      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Org', type: 'INVALID', document: '11222333000181' });

      expect(response.status).toBe(400);
      expect(mockedService.createOrganization).not.toHaveBeenCalled();
    });

    it('should return 400 when document is missing', async () => {
      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Org', type: 'PJ' });

      expect(response.status).toBe(400);
      expect(mockedService.createOrganization).not.toHaveBeenCalled();
    });

    it('should return 400 on invalid document', async () => {
      mockedService.createOrganization.mockRejectedValue(
        new orgService.OrgError('Documento inválido', 400),
      );

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Org', type: 'PJ', document: '00000000000000' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Documento inválido');
    });

    it('should return 409 on duplicate document', async () => {
      mockedService.createOrganization.mockRejectedValue(
        new orgService.OrgError('Documento já cadastrado', 409),
      );

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Documento já cadastrado');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.createOrganization.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── GET /api/admin/organizations ───────────────────────────────

  describe('GET /api/admin/organizations', () => {
    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 200 with paginated list', async () => {
      const result = {
        data: [{ id: 'org-1', name: 'Org 1' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listOrganizations.mockResolvedValue(result as never);

      const response = await request(app)
        .get('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.total).toBe(1);
    });

    it('should pass query params to service', async () => {
      mockedService.listOrganizations.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      } as never);

      await request(app)
        .get('/api/admin/organizations?page=2&limit=10&status=ACTIVE&search=farm')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listOrganizations).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        status: 'ACTIVE',
        search: 'farm',
      });
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.listOrganizations.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  // ─── GET /api/admin/organizations/:id ───────────────────────────

  describe('GET /api/admin/organizations/:id', () => {
    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 200 with organization', async () => {
      const org = { id: 'org-1', name: 'Org 1', _count: { users: 5, farms: 3 } };
      mockedService.getOrganizationById.mockResolvedValue(org as never);

      const response = await request(app)
        .get('/api/admin/organizations/org-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('org-1');
    });

    it('should return 404 when not found', async () => {
      mockedService.getOrganizationById.mockRejectedValue(
        new orgService.OrgError('Organização não encontrada', 404),
      );

      const response = await request(app)
        .get('/api/admin/organizations/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.getOrganizationById.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/admin/organizations/org-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  // ─── PATCH /api/admin/organizations/:id/status ──────────────────

  describe('PATCH /api/admin/organizations/:id/status', () => {
    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 200 on successful status update', async () => {
      const updated = { id: 'org-1', status: 'SUSPENDED' };
      mockedService.updateOrganizationStatus.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'SUSPENDED' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('SUSPENDED');
    });

    it('should return 400 when status is missing', async () => {
      const response = await request(app)
        .patch('/api/admin/organizations/org-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(mockedService.updateOrganizationStatus).not.toHaveBeenCalled();
    });

    it('should return 400 when status value is invalid', async () => {
      const response = await request(app)
        .patch('/api/admin/organizations/org-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INVALID' });

      expect(response.status).toBe(400);
      expect(mockedService.updateOrganizationStatus).not.toHaveBeenCalled();
    });

    it('should return 404 when org not found', async () => {
      mockedService.updateOrganizationStatus.mockRejectedValue(
        new orgService.OrgError('Organização não encontrada', 404),
      );

      const response = await request(app)
        .patch('/api/admin/organizations/non-existent/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'SUSPENDED' });

      expect(response.status).toBe(404);
    });

    it('should return 422 on invalid transition', async () => {
      mockedService.updateOrganizationStatus.mockRejectedValue(
        new orgService.OrgError('Transição de status CANCELLED → ACTIVE não permitida', 422),
      );

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'ACTIVE' });

      expect(response.status).toBe(422);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.updateOrganizationStatus.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'SUSPENDED' });

      expect(response.status).toBe(500);
    });
  });

  // ─── PATCH /api/admin/organizations/:id/plan ────────────────────

  describe('PATCH /api/admin/organizations/:id/plan', () => {
    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 200 on successful plan update', async () => {
      const updated = { id: 'org-1', plan: 'professional', maxUsers: 50 };
      mockedService.updateOrganizationPlan.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/plan')
        .set('Authorization', 'Bearer valid-token')
        .send({ plan: 'professional', maxUsers: 50 });

      expect(response.status).toBe(200);
      expect(response.body.plan).toBe('professional');
    });

    it('should return 400 when plan is missing', async () => {
      const response = await request(app)
        .patch('/api/admin/organizations/org-1/plan')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(mockedService.updateOrganizationPlan).not.toHaveBeenCalled();
    });

    it('should return 400 on invalid plan', async () => {
      mockedService.updateOrganizationPlan.mockRejectedValue(
        new orgService.OrgError('Plano inválido', 400),
      );

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/plan')
        .set('Authorization', 'Bearer valid-token')
        .send({ plan: 'invalid-plan' });

      expect(response.status).toBe(400);
    });

    it('should return 404 when org not found', async () => {
      mockedService.updateOrganizationPlan.mockRejectedValue(
        new orgService.OrgError('Organização não encontrada', 404),
      );

      const response = await request(app)
        .patch('/api/admin/organizations/non-existent/plan')
        .set('Authorization', 'Bearer valid-token')
        .send({ plan: 'professional' });

      expect(response.status).toBe(404);
    });

    it('should return 422 when reducing limits below current count', async () => {
      mockedService.updateOrganizationPlan.mockRejectedValue(
        new orgService.OrgError('Limite de usuários (5) menor que a quantidade atual (10)', 422),
      );

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/plan')
        .set('Authorization', 'Bearer valid-token')
        .send({ plan: 'basic', maxUsers: 5 });

      expect(response.status).toBe(422);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.updateOrganizationPlan.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/plan')
        .set('Authorization', 'Bearer valid-token')
        .send({ plan: 'professional' });

      expect(response.status).toBe(500);
    });
  });

  // ─── PATCH /api/admin/organizations/:id/session-policy ───────────

  describe('PATCH /api/admin/organizations/:id/session-policy', () => {
    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 200 on successful update', async () => {
      const updated = { id: 'org-1', allowMultipleSessions: false };
      mockedService.updateSessionPolicy.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/session-policy')
        .set('Authorization', 'Bearer valid-token')
        .send({ allowMultipleSessions: false });

      expect(response.status).toBe(200);
      expect(response.body.allowMultipleSessions).toBe(false);
      expect(mockedService.updateSessionPolicy).toHaveBeenCalledWith('org-1', false);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          action: 'UPDATE_SESSION_POLICY',
          targetType: 'organization',
          targetId: 'org-1',
          metadata: { allowMultipleSessions: false },
        }),
      );
    });

    it('should return 400 when allowMultipleSessions is missing', async () => {
      const response = await request(app)
        .patch('/api/admin/organizations/org-1/session-policy')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.updateSessionPolicy).not.toHaveBeenCalled();
    });

    it('should return 400 when allowMultipleSessions is not boolean', async () => {
      const response = await request(app)
        .patch('/api/admin/organizations/org-1/session-policy')
        .set('Authorization', 'Bearer valid-token')
        .send({ allowMultipleSessions: 'yes' });

      expect(response.status).toBe(400);
      expect(mockedService.updateSessionPolicy).not.toHaveBeenCalled();
    });

    it('should return 404 when org not found', async () => {
      mockedService.updateSessionPolicy.mockRejectedValue(
        new orgService.OrgError('Organização não encontrada', 404),
      );

      const response = await request(app)
        .patch('/api/admin/organizations/non-existent/session-policy')
        .set('Authorization', 'Bearer valid-token')
        .send({ allowMultipleSessions: true });

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.updateSessionPolicy.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/session-policy')
        .set('Authorization', 'Bearer valid-token')
        .send({ allowMultipleSessions: false });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── POST /api/admin/organizations/:id/users ─────────────────────

  describe('POST /api/admin/organizations/:id/users', () => {
    const validBody = { name: 'Novo Admin', email: 'novo@org.com' };

    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 201 on success', async () => {
      const created = { id: 'user-new', ...validBody, role: 'ADMIN', status: 'ACTIVE' };
      mockedService.createOrgAdmin.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/admin/organizations/org-1/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('user-new');
      expect(mockedService.createOrgAdmin).toHaveBeenCalledWith('org-1', {
        name: 'Novo Admin',
        email: 'novo@org.com',
        phone: undefined,
      });
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/admin/organizations/org-1/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'novo@org.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.createOrgAdmin).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/admin/organizations/org-1/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Novo Admin' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockedService.createOrgAdmin).not.toHaveBeenCalled();
    });

    it('should return 404 when org not found', async () => {
      mockedService.createOrgAdmin.mockRejectedValue(
        new orgService.OrgError('Organização não encontrada', 404),
      );

      const response = await request(app)
        .post('/api/admin/organizations/non-existent/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(404);
    });

    it('should return 409 on duplicate email', async () => {
      mockedService.createOrgAdmin.mockRejectedValue(
        new orgService.OrgError('Email já cadastrado', 409),
      );

      const response = await request(app)
        .post('/api/admin/organizations/org-1/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email já cadastrado');
    });

    it('should return 422 when org not active', async () => {
      mockedService.createOrgAdmin.mockRejectedValue(
        new orgService.OrgError('Organização não está ativa', 422),
      );

      const response = await request(app)
        .post('/api/admin/organizations/org-1/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(422);
      expect(response.body.error).toBe('Organização não está ativa');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.createOrgAdmin.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/admin/organizations/org-1/users')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(500);
    });
  });

  // ─── POST /api/admin/organizations/:id/users/:userId/reset-password

  describe('POST /api/admin/organizations/:id/users/:userId/reset-password', () => {
    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 200 on success', async () => {
      mockedService.resetOrgUserPassword.mockResolvedValue({
        message: 'Email de redefinição de senha enviado',
      } as never);

      const response = await request(app)
        .post('/api/admin/organizations/org-1/users/user-1/reset-password')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email de redefinição de senha enviado');
      expect(mockedService.resetOrgUserPassword).toHaveBeenCalledWith('org-1', 'user-1');
    });

    it('should return 404 when not found', async () => {
      mockedService.resetOrgUserPassword.mockRejectedValue(
        new orgService.OrgError('Usuário não encontrado nesta organização', 404),
      );

      const response = await request(app)
        .post('/api/admin/organizations/org-1/users/non-existent/reset-password')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.resetOrgUserPassword.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/admin/organizations/org-1/users/user-1/reset-password')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });

  // ─── PATCH /api/admin/organizations/:id/users/:userId/unlock ─────

  describe('PATCH /api/admin/organizations/:id/users/:userId/unlock', () => {
    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 200 on success', async () => {
      const updated = { id: 'user-1', status: 'ACTIVE' };
      mockedService.unlockOrgUser.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/users/user-1/unlock')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACTIVE');
      expect(mockedService.unlockOrgUser).toHaveBeenCalledWith('org-1', 'user-1');
    });

    it('should return 404 when not found', async () => {
      mockedService.unlockOrgUser.mockRejectedValue(
        new orgService.OrgError('Usuário não encontrado nesta organização', 404),
      );

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/users/non-existent/unlock')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 422 when already active', async () => {
      mockedService.unlockOrgUser.mockRejectedValue(
        new orgService.OrgError('Usuário já está ativo', 422),
      );

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/users/user-1/unlock')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(422);
      expect(response.body.error).toBe('Usuário já está ativo');
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.unlockOrgUser.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .patch('/api/admin/organizations/org-1/users/user-1/unlock')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
    });
  });
});
