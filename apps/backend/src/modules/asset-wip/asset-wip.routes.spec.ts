import request from 'supertest';
import { app } from '../../app';
import * as wipService from './asset-wip.service';
import * as authService from '../auth/auth.service';
import { WipError } from './asset-wip.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-wip.service', () => ({
  addContribution: jest.fn(),
  getWipSummary: jest.fn(),
  activateWipAsset: jest.fn(),
  createStage: jest.fn(),
  completeStage: jest.fn(),
  listStages: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(wipService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';
const ASSET_ID = 'wip-asset-1';

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: ORG_ID,
};

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const BASE_URL = `/api/org/${ORG_ID}/asset-wip/${ASSET_ID}`;

const VALID_CONTRIBUTION = {
  id: 'contrib-1',
  organizationId: ORG_ID,
  assetId: ASSET_ID,
  contributionDate: new Date('2025-03-01'),
  amount: '5000.00',
  description: 'Fundação',
  stageId: null,
  supplierId: null,
  invoiceRef: null,
  notes: null,
  createdAt: new Date('2025-03-01'),
};

const VALID_STAGE = {
  id: 'stage-1',
  organizationId: ORG_ID,
  assetId: ASSET_ID,
  name: 'Fundação',
  targetDate: null,
  completedAt: null,
  notes: null,
  sortOrder: 0,
  createdAt: new Date('2025-03-01'),
};

describe('Asset WIP API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post(`${BASE_URL}/contributions`);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST contributions ──────────────────────────────────────────────

  describe('POST /org/:orgId/asset-wip/:assetId/contributions', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('creates contribution to EM_ANDAMENTO asset -> 201 with contribution record', async () => {
      mockedService.addContribution.mockResolvedValue({
        contribution: VALID_CONTRIBUTION,
        totalContributed: 5000,
        budgetAlert: false,
        budgetExceeded: false,
      } as never);

      const res = await request(app)
        .post(`${BASE_URL}/contributions`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          contributionDate: '2025-03-01',
          amount: 5000,
          description: 'Fundação',
        });

      expect(res.status).toBe(201);
      expect(res.body.contribution).toBeDefined();
      expect(res.body.totalContributed).toBe(5000);
      expect(res.body.budgetAlert).toBe(false);
      expect(mockedService.addContribution).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        ASSET_ID,
        expect.objectContaining({ amount: 5000, description: 'Fundação' }),
      );
    });

    it('returns budgetAlert=true when totalContributed >= 90% of wipBudget', async () => {
      mockedService.addContribution.mockResolvedValue({
        contribution: VALID_CONTRIBUTION,
        totalContributed: 90000,
        budgetAlert: true,
        budgetExceeded: false,
      } as never);

      const res = await request(app)
        .post(`${BASE_URL}/contributions`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          contributionDate: '2025-03-01',
          amount: 90000,
          description: 'Construção avançada',
        });

      expect(res.status).toBe(201);
      expect(res.body.budgetAlert).toBe(true);
      expect(res.body.budgetExceeded).toBe(false);
    });

    it('returns budgetExceeded=true when totalContributed > wipBudget', async () => {
      mockedService.addContribution.mockResolvedValue({
        contribution: VALID_CONTRIBUTION,
        totalContributed: 110000,
        budgetAlert: true,
        budgetExceeded: true,
      } as never);

      const res = await request(app)
        .post(`${BASE_URL}/contributions`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          contributionDate: '2025-03-01',
          amount: 110000,
          description: 'Custo extra',
        });

      expect(res.status).toBe(201);
      expect(res.body.budgetExceeded).toBe(true);
    });

    it('returns 400 when asset is not EM_ANDAMENTO', async () => {
      mockedService.addContribution.mockRejectedValue(
        new WipError('Apenas ativos em andamento aceitam aportes', 400),
      );

      const res = await request(app)
        .post(`${BASE_URL}/contributions`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          contributionDate: '2025-03-01',
          amount: 5000,
          description: 'Aporte inválido',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('em andamento');
    });
  });

  // ─── GET summary ─────────────────────────────────────────────────────

  describe('GET /org/:orgId/asset-wip/:assetId/summary', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns asset info + totalContributed + contributions + stages + budget flags', async () => {
      mockedService.getWipSummary.mockResolvedValue({
        assetId: ASSET_ID,
        assetName: 'Galpão em construção',
        assetTag: 'PAT-00010',
        status: 'EM_ANDAMENTO',
        budget: 100000,
        budgetAlertPct: 90,
        totalContributed: 45000,
        contributionCount: 3,
        budgetAlert: false,
        budgetExceeded: false,
        stages: [VALID_STAGE],
        contributions: [VALID_CONTRIBUTION],
      } as never);

      const res = await request(app)
        .get(`${BASE_URL}/summary`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.assetId).toBe(ASSET_ID);
      expect(res.body.totalContributed).toBe(45000);
      expect(res.body.stages).toHaveLength(1);
      expect(res.body.contributions).toHaveLength(1);
      expect(res.body.budgetAlert).toBe(false);
    });
  });

  // ─── POST activate ───────────────────────────────────────────────────

  describe('POST /org/:orgId/asset-wip/:assetId/activate', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('activates EM_ANDAMENTO asset -> 200, status=ATIVO, acquisitionValue=totalContributed', async () => {
      mockedService.activateWipAsset.mockResolvedValue({
        assetId: ASSET_ID,
        finalValue: 95000,
        depreciationConfigMissing: false,
      } as never);

      const res = await request(app)
        .post(`${BASE_URL}/activate`)
        .set('Authorization', 'Bearer valid-token')
        .send({ activationDate: '2025-06-01' });

      expect(res.status).toBe(200);
      expect(res.body.assetId).toBe(ASSET_ID);
      expect(res.body.finalValue).toBe(95000);
      expect(res.body.depreciationConfigMissing).toBe(false);
    });

    it('returns depreciationConfigMissing=true when no DepreciationConfig exists', async () => {
      mockedService.activateWipAsset.mockResolvedValue({
        assetId: ASSET_ID,
        finalValue: 95000,
        depreciationConfigMissing: true,
      } as never);

      const res = await request(app)
        .post(`${BASE_URL}/activate`)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.depreciationConfigMissing).toBe(true);
    });

    it('returns 404 when asset is not EM_ANDAMENTO', async () => {
      mockedService.activateWipAsset.mockRejectedValue(
        new WipError('Ativo em andamento nao encontrado', 404),
      );

      const res = await request(app)
        .post(`${BASE_URL}/activate`)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('em andamento');
    });
  });

  // ─── GET stages ──────────────────────────────────────────────────────

  describe('GET /org/:orgId/asset-wip/:assetId/stages', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns list of stages ordered by sortOrder', async () => {
      const stages = [
        { ...VALID_STAGE, sortOrder: 0 },
        { ...VALID_STAGE, id: 'stage-2', name: 'Estrutura', sortOrder: 1 },
      ];
      mockedService.listStages.mockResolvedValue(stages as never);

      const res = await request(app)
        .get(`${BASE_URL}/stages`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].sortOrder).toBe(0);
      expect(res.body[1].sortOrder).toBe(1);
    });
  });
});
