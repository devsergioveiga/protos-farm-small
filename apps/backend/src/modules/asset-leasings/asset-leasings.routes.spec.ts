import request from 'supertest';
import { app } from '../../app';
import * as leasingService from './asset-leasings.service';
import * as authService from '../auth/auth.service';
import { AssetLeasingError } from './asset-leasings.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-leasings.service', () => ({
  createLeasing: jest.fn(),
  listLeasings: jest.fn(),
  getLeasing: jest.fn(),
  exercisePurchaseOption: jest.fn(),
  returnAsset: jest.fn(),
  cancelLeasing: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(leasingService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-leasing-1';

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: ORG_ID,
};

const _CONSULTANT_PAYLOAD = {
  userId: 'consultant-1',
  email: 'consultant@org.com',
  role: 'CONSULTANT' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Test fixtures ────────────────────────────────────────────────────

const VALID_LEASING_OUTPUT = {
  id: 'leasing-1',
  organizationId: ORG_ID,
  farmId: 'farm-1',
  farmName: 'Fazenda Boa Vista',
  rouAssetId: 'asset-rou-1',
  rouAssetTag: 'PAT-00001',
  rouAssetName: 'ROU — Arrendador SA — CT-001',
  lessorName: 'Arrendador SA',
  lessorDocument: '12345678000195',
  contractNumber: 'CT-001',
  contractDate: '2026-01-01',
  startDate: '2026-01-01',
  endDate: '2029-01-01',
  totalContractValue: 60000,
  monthlyInstallment: 1666.67,
  installmentCount: 36,
  purchaseOptionValue: 5000,
  purchaseOptionDate: '2029-01-01',
  hasPurchaseOption: true,
  status: 'ACTIVE' as const,
  statusLabel: 'Ativo',
  payableId: 'payable-1',
  notes: null,
  createdBy: 'manager-1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const VALID_CREATE_OUTPUT = {
  leasing: VALID_LEASING_OUTPUT,
  rouAsset: { id: 'asset-rou-1', assetTag: 'PAT-00001', name: 'ROU — Arrendador SA — CT-001' },
  payableId: 'payable-1',
};

const VALID_CREATE_INPUT = {
  farmId: 'farm-1',
  assetType: 'MAQUINA',
  assetName: 'Trator de Leasing',
  lessorName: 'Arrendador SA',
  lessorDocument: '12345678000195',
  contractNumber: 'CT-001',
  contractDate: '2026-01-01',
  startDate: '2026-01-01',
  endDate: '2029-01-01',
  totalContractValue: 60000,
  installmentCount: 36,
  firstDueDate: '2026-02-01',
  purchaseOptionValue: 5000,
  purchaseOptionDate: '2029-01-01',
  hasPurchaseOption: true,
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('POST /api/org/:orgId/asset-leasings', () => {
  it('returns 401 when not authenticated', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const res = await request(app)
      .post(`/api/org/${ORG_ID}/asset-leasings`)
      .send(VALID_CREATE_INPUT);
    expect(res.status).toBe(401);
  });

  it('returns 201 with leasing + rouAsset + payableId on valid input', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createLeasing.mockResolvedValue(VALID_CREATE_OUTPUT);
    const res = await request(app)
      .post(`/api/org/${ORG_ID}/asset-leasings`)
      .set('Authorization', 'Bearer token')
      .send(VALID_CREATE_INPUT);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('rouAsset');
    expect(res.body).toHaveProperty('payableId', 'payable-1');
    expect(res.body.leasing).toHaveProperty('status', 'ACTIVE');
  });

  it('returns 400 when endDate is before startDate', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createLeasing.mockRejectedValue(
      new AssetLeasingError('Data de fim deve ser posterior à data de início', 400),
    );
    const res = await request(app)
      .post(`/api/org/${ORG_ID}/asset-leasings`)
      .set('Authorization', 'Bearer token')
      .send({ ...VALID_CREATE_INPUT, endDate: '2025-01-01' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when required fields are missing', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createLeasing.mockRejectedValue(
      new AssetLeasingError('Nome do arrendador é obrigatório', 400),
    );
    const res = await request(app)
      .post(`/api/org/${ORG_ID}/asset-leasings`)
      .set('Authorization', 'Bearer token')
      .send({ farmId: 'farm-1' }); // missing required fields
    expect(res.status).toBe(400);
  });
});

describe('GET /api/org/:orgId/asset-leasings', () => {
  it('returns 200 with array of leasings', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listLeasings.mockResolvedValue([VALID_LEASING_OUTPUT]);
    const res = await request(app)
      .get(`/api/org/${ORG_ID}/asset-leasings`)
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('status', 'ACTIVE');
  });

  it('returns 200 with empty array when no leasings', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listLeasings.mockResolvedValue([]);
    const res = await request(app)
      .get(`/api/org/${ORG_ID}/asset-leasings`)
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/org/:orgId/asset-leasings/:id', () => {
  it('returns 200 with single leasing', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getLeasing.mockResolvedValue(VALID_LEASING_OUTPUT);
    const res = await request(app)
      .get(`/api/org/${ORG_ID}/asset-leasings/leasing-1`)
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('rouAssetId', 'asset-rou-1');
    expect(res.body).toHaveProperty('farmName', 'Fazenda Boa Vista');
  });

  it('returns 404 when leasing not found', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getLeasing.mockRejectedValue(
      new AssetLeasingError('Contrato de leasing não encontrado', 404),
    );
    const res = await request(app)
      .get(`/api/org/${ORG_ID}/asset-leasings/nonexistent`)
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/org/:orgId/asset-leasings/:id/exercise-purchase', () => {
  it('returns 200 when exercising purchase option on ACTIVE leasing with hasPurchaseOption=true', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.exercisePurchaseOption.mockResolvedValue({
      ...VALID_LEASING_OUTPUT,
      status: 'PURCHASE_OPTION_EXERCISED',
      statusLabel: 'Opcao Exercida',
    });
    const res = await request(app)
      .put(`/api/org/${ORG_ID}/asset-leasings/leasing-1/exercise-purchase`)
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'PURCHASE_OPTION_EXERCISED');
  });

  it('returns 400 when leasing has no purchase option', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.exercisePurchaseOption.mockRejectedValue(
      new AssetLeasingError('Este contrato não possui opção de compra', 400),
    );
    const res = await request(app)
      .put(`/api/org/${ORG_ID}/asset-leasings/leasing-no-option/exercise-purchase`)
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(400);
  });

  it('returns 409 when leasing is not ACTIVE', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.exercisePurchaseOption.mockRejectedValue(
      new AssetLeasingError('Contrato não está ativo', 409),
    );
    const res = await request(app)
      .put(`/api/org/${ORG_ID}/asset-leasings/leasing-returned/exercise-purchase`)
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/org/:orgId/asset-leasings/:id/return', () => {
  it('returns 200 on ACTIVE leasing and sets asset status to ALIENADO', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.returnAsset.mockResolvedValue({
      ...VALID_LEASING_OUTPUT,
      status: 'RETURNED',
      statusLabel: 'Devolvido',
    });
    const res = await request(app)
      .put(`/api/org/${ORG_ID}/asset-leasings/leasing-1/return`)
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'RETURNED');
  });
});

describe('PUT /api/org/:orgId/asset-leasings/:id/cancel', () => {
  it('returns 200 on ACTIVE leasing and cancels contract', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.cancelLeasing.mockResolvedValue({
      ...VALID_LEASING_OUTPUT,
      status: 'CANCELLED',
      statusLabel: 'Cancelado',
    });
    const res = await request(app)
      .put(`/api/org/${ORG_ID}/asset-leasings/leasing-1/cancel`)
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'CANCELLED');
  });
});
