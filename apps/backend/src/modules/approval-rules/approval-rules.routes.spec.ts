import request from 'supertest';
import { app } from '../../app';
import * as approvalRulesService from './approval-rules.service';
import * as authService from '../auth/auth.service';
import { ApprovalRuleError } from './approval-rules.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./approval-rules.service', () => ({
  createApprovalRule: jest.fn(),
  listApprovalRules: jest.fn(),
  getApprovalRuleById: jest.fn(),
  updateApprovalRule: jest.fn(),
  deleteApprovalRule: jest.fn(),
  reorderApprovalRules: jest.fn(),
  matchApprovalRule: jest.fn(),
  resolveApprover: jest.fn(),
  createDelegation: jest.fn(),
  listDelegations: jest.fn(),
  deactivateDelegation: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(approvalRulesService);
const mockedAuth = jest.mocked(authService);

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const VALID_RULE = {
  id: 'rule-1',
  organizationId: 'org-1',
  name: 'Regra Insumos',
  requestType: 'INSUMO_AGRICOLA',
  minAmount: 0,
  maxAmount: null,
  approverCount: 1,
  approver1Id: 'manager-1',
  approver2Id: null,
  priority: 1,
  active: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  approver1: { id: 'manager-1', name: 'Gerente' },
  approver2: null,
};

const VALID_DELEGATION = {
  id: 'del-1',
  organizationId: 'org-1',
  delegatorId: 'manager-1',
  delegateId: 'user-2',
  startDate: new Date('2026-02-01'),
  endDate: new Date('2026-02-28'),
  active: true,
  notes: null,
  createdAt: new Date('2026-01-01'),
  delegate: { id: 'user-2', name: 'Delegado' },
};

describe('ApprovalRules endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── POST /api/org/approval-rules ───────────────────────────────────

  describe('POST /api/org/approval-rules', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should create rule with approverCount=1 and return 201', async () => {
      mockedService.createApprovalRule.mockResolvedValue(VALID_RULE as never);

      const response = await request(app)
        .post('/api/org/approval-rules')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Regra Insumos',
          requestType: 'INSUMO_AGRICOLA',
          approverCount: 1,
          approver1Id: 'manager-1',
          priority: 1,
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('rule-1');
      expect(mockedService.createApprovalRule).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ approverCount: 1 }),
      );
    });

    it('should return 400 when approverCount is invalid (not 1 or 2)', async () => {
      mockedService.createApprovalRule.mockRejectedValue(
        new ApprovalRuleError('approverCount deve ser 1 ou 2', 400),
      );

      const response = await request(app)
        .post('/api/org/approval-rules')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Regra',
          approverCount: 3,
          approver1Id: 'manager-1',
          priority: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('approverCount');
    });

    it('should return 400 when approverCount=2 but approver2Id missing', async () => {
      mockedService.createApprovalRule.mockRejectedValue(
        new ApprovalRuleError('approver2Id é obrigatório quando approverCount é 2', 400),
      );

      const response = await request(app)
        .post('/api/org/approval-rules')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Regra Dupla',
          approverCount: 2,
          approver1Id: 'manager-1',
          priority: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('approver2Id');
    });
  });

  // ─── GET /api/org/approval-rules ────────────────────────────────────

  describe('GET /api/org/approval-rules', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should return list ordered by priority', async () => {
      mockedService.listApprovalRules.mockResolvedValue([VALID_RULE] as never);

      const response = await request(app)
        .get('/api/org/approval-rules')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('rule-1');
      expect(mockedService.listApprovalRules).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ includeInactive: false }),
      );
    });
  });

  // ─── PUT /api/org/approval-rules/:id ────────────────────────────────

  describe('PUT /api/org/approval-rules/:id', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should update rule and return 200', async () => {
      const updated = { ...VALID_RULE, name: 'Regra Atualizada' };
      mockedService.updateApprovalRule.mockResolvedValue(updated as never);

      const response = await request(app)
        .put('/api/org/approval-rules/rule-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Regra Atualizada' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Regra Atualizada');
    });
  });

  // ─── DELETE /api/org/approval-rules/:id ─────────────────────────────

  describe('DELETE /api/org/approval-rules/:id', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should delete rule and return 204', async () => {
      mockedService.deleteApprovalRule.mockResolvedValue({ success: true } as never);

      const response = await request(app)
        .delete('/api/org/approval-rules/rule-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(mockedService.deleteApprovalRule).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'rule-1',
      );
    });
  });

  // ─── POST /api/org/approval-rules/reorder ────────────────────────────

  describe('POST /api/org/approval-rules/reorder', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should reorder rules by provided orderedIds', async () => {
      mockedService.reorderApprovalRules.mockResolvedValue({ success: true } as never);

      const response = await request(app)
        .post('/api/org/approval-rules/reorder')
        .set('Authorization', 'Bearer valid-token')
        .send({ orderedIds: ['rule-2', 'rule-1'] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockedService.reorderApprovalRules).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        ['rule-2', 'rule-1'],
      );
    });

    it('should return 400 when orderedIds is not an array', async () => {
      const response = await request(app)
        .post('/api/org/approval-rules/reorder')
        .set('Authorization', 'Bearer valid-token')
        .send({ orderedIds: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('orderedIds');
    });
  });

  // ─── POST /api/org/approval-rules/delegations ─────────────────────

  describe('POST /api/org/approval-rules/delegations', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should create delegation and return 201', async () => {
      mockedService.createDelegation.mockResolvedValue(VALID_DELEGATION as never);

      const response = await request(app)
        .post('/api/org/approval-rules/delegations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          delegateId: 'user-2',
          startDate: '2026-02-01T00:00:00Z',
          endDate: '2026-02-28T23:59:59Z',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('del-1');
      expect(mockedService.createDelegation).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', userId: 'manager-1' }),
        expect.objectContaining({ delegateId: 'user-2' }),
      );
    });

    it('should return 400 when date range is invalid', async () => {
      mockedService.createDelegation.mockRejectedValue(
        new ApprovalRuleError('A data de início deve ser anterior à data de término', 400),
      );

      const response = await request(app)
        .post('/api/org/approval-rules/delegations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          delegateId: 'user-2',
          startDate: '2026-02-28T00:00:00Z',
          endDate: '2026-02-01T00:00:00Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('data');
    });
  });

  // ─── GET /api/org/approval-rules/delegations ─────────────────────

  describe('GET /api/org/approval-rules/delegations', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should return list of user delegations', async () => {
      mockedService.listDelegations.mockResolvedValue([VALID_DELEGATION] as never);

      const response = await request(app)
        .get('/api/org/approval-rules/delegations')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('del-1');
    });
  });

  // ─── PATCH /api/org/approval-rules/delegations/:id/deactivate ─────

  describe('PATCH /api/org/approval-rules/delegations/:id/deactivate', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should deactivate delegation and return 200', async () => {
      const deactivated = { ...VALID_DELEGATION, active: false };
      mockedService.deactivateDelegation.mockResolvedValue(deactivated as never);

      const response = await request(app)
        .patch('/api/org/approval-rules/delegations/del-1/deactivate')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(false);
      expect(mockedService.deactivateDelegation).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', userId: 'manager-1' }),
        'del-1',
      );
    });
  });

  // ─── Auth guard ──────────────────────────────────────────────────────

  describe('Auth', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/org/approval-rules');

      expect(response.status).toBe(401);
    });
  });
});
