import request from 'supertest';
import { app } from '../../app';
import * as renovationsService from './asset-renovations.service';
import * as authService from '../auth/auth.service';
import { RenovationError } from './asset-renovations.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-renovations.service', () => ({
  createRenovation: jest.fn(),
  listRenovations: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(renovationsService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';
const ASSET_ID = 'asset-1';

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

const VALID_RENOVATION = {
  id: 'reno-1',
  organizationId: ORG_ID,
  assetId: ASSET_ID,
  description: 'Troca de motor',
  renovationDate: new Date('2025-01-10'),
  totalCost: '15000.00',
  accountingDecision: 'CAPITALIZAR',
  newUsefulLifeMonths: 60,
  notes: null,
  createdAt: new Date('2025-01-10'),
};

const BASE_URL = `/api/org/${ORG_ID}/assets/${ASSET_ID}/renovations`;

describe('Asset Renovations API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post(BASE_URL);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /org/:orgId/assets/:assetId/renovations ───────────────────

  describe('POST /org/:orgId/assets/:assetId/renovations', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('creates renovation with CAPITALIZAR -> 201', async () => {
      mockedService.createRenovation.mockResolvedValue(VALID_RENOVATION as never);

      const res = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          description: 'Troca de motor',
          renovationDate: '2025-01-10',
          totalCost: 15000,
          accountingDecision: 'CAPITALIZAR',
          newUsefulLifeMonths: 60,
        });

      expect(res.status).toBe(201);
      expect(res.body.accountingDecision).toBe('CAPITALIZAR');
      expect(mockedService.createRenovation).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        ASSET_ID,
        expect.objectContaining({ accountingDecision: 'CAPITALIZAR', totalCost: 15000 }),
      );
    });

    it('creates renovation with DESPESA -> 201, service called with DESPESA', async () => {
      const despesaRenovation = { ...VALID_RENOVATION, accountingDecision: 'DESPESA' };
      mockedService.createRenovation.mockResolvedValue(despesaRenovation as never);

      const res = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          description: 'Pintura externa',
          renovationDate: '2025-02-01',
          totalCost: 5000,
          accountingDecision: 'DESPESA',
        });

      expect(res.status).toBe(201);
      expect(mockedService.createRenovation).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        ASSET_ID,
        expect.objectContaining({ accountingDecision: 'DESPESA' }),
      );
    });

    it('rejects renovation on ALIENADO asset -> 400', async () => {
      mockedService.createRenovation.mockRejectedValue(
        new RenovationError('Ativo alienado nao pode ser reformado', 400),
      );

      const res = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          description: 'Reforma',
          renovationDate: '2025-01-10',
          totalCost: 1000,
          accountingDecision: 'DESPESA',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('alienado');
    });

    it('rejects renovation on EM_ANDAMENTO asset -> 400', async () => {
      mockedService.createRenovation.mockRejectedValue(
        new RenovationError('Ativo em andamento nao pode ser reformado', 400),
      );

      const res = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          description: 'Reforma',
          renovationDate: '2025-01-10',
          totalCost: 1000,
          accountingDecision: 'DESPESA',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('em andamento');
    });
  });

  // ─── GET /org/:orgId/assets/:assetId/renovations ────────────────────

  describe('GET /org/:orgId/assets/:assetId/renovations', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns list of renovations ordered by renovationDate desc -> 200', async () => {
      const list = [VALID_RENOVATION, { ...VALID_RENOVATION, id: 'reno-2', totalCost: '3000.00' }];
      mockedService.listRenovations.mockResolvedValue(list as never);

      const res = await request(app)
        .get(BASE_URL)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockedService.listRenovations).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        ASSET_ID,
      );
    });
  });
});
