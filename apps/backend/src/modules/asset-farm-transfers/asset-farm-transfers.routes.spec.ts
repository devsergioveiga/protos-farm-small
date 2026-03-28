import request from 'supertest';
import { app } from '../../app';
import * as transferService from './asset-farm-transfers.service';
import * as authService from '../auth/auth.service';
import { AssetTransferError } from './asset-farm-transfers.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-farm-transfers.service', () => ({
  createTransfer: jest.fn(),
  listTransfers: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(transferService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';
const ASSET_ID = 'asset-1';

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: ORG_ID,
};

const _VIEWER_PAYLOAD = {
  userId: 'viewer-1',
  email: 'viewer@org.com',
  role: 'CONSULTANT' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Fixtures ──────────────────────────────────────────────────────────

const TRANSFER_OUTPUT = {
  id: 'transfer-1',
  assetId: ASSET_ID,
  assetTag: 'PAT-00001',
  assetName: 'Trator John Deere',
  fromFarmId: 'farm-1',
  fromFarmName: 'Fazenda A',
  toFarmId: 'farm-2',
  toFarmName: 'Fazenda B',
  transferDate: '2026-04-25T00:00:00.000Z',
  fromCostCenterId: null,
  toCostCenterId: null,
  notes: null,
  createdBy: 'manager-1',
  createdAt: '2026-04-25T10:00:00.000Z',
};

const BASE = `/api/org/${ORG_ID}/asset-farm-transfers`;

// ─── Tests ────────────────────────────────────────────────────────────

describe('Asset Farm Transfers API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Test 1: POST transfer creates record and updates asset.farmId ─────

  it('Test 1: POST /:assetId/transfer creates transfer record and updates asset.farmId — returns 201', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTransfer.mockResolvedValue(TRANSFER_OUTPUT);

    const res = await request(app)
      .post(`${BASE}/${ASSET_ID}/transfer`)
      .set('Authorization', 'Bearer token')
      .send({
        toFarmId: 'farm-2',
        transferDate: '2026-04-25',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('transfer-1');
    expect(res.body.toFarmId).toBe('farm-2');
    expect(mockedService.createTransfer).toHaveBeenCalledTimes(1);
  });

  // ─── Test 2: Transfer updates asset.costCenterId when toCostCenterId provided ──

  it('Test 2: Transfer also updates asset.costCenterId when toCostCenterId provided', async () => {
    authAs(MANAGER_PAYLOAD);
    const outputWithCC = {
      ...TRANSFER_OUTPUT,
      toCostCenterId: 'cc-2',
    };
    mockedService.createTransfer.mockResolvedValue(outputWithCC);

    const res = await request(app)
      .post(`${BASE}/${ASSET_ID}/transfer`)
      .set('Authorization', 'Bearer token')
      .send({
        toFarmId: 'farm-2',
        transferDate: '2026-04-25',
        toCostCenterId: 'cc-2',
      });

    expect(res.status).toBe(201);
    expect(res.body.toCostCenterId).toBe('cc-2');
    expect(mockedService.createTransfer).toHaveBeenCalledWith(
      { organizationId: ORG_ID },
      ASSET_ID,
      expect.objectContaining({ toCostCenterId: 'cc-2' }),
      'manager-1',
    );
  });

  // ─── Test 3: Transfer rejects destination farm from different org ─────

  it('Test 3: Transfer rejects when destination farm belongs to different org — returns 400', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTransfer.mockRejectedValue(
      new AssetTransferError('Fazenda destino nao encontrada na organizacao', 400),
    );

    const res = await request(app)
      .post(`${BASE}/${ASSET_ID}/transfer`)
      .set('Authorization', 'Bearer token')
      .send({
        toFarmId: 'farm-other-org',
        transferDate: '2026-04-25',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Fazenda destino');
  });

  // ─── Test 4: Transfer rejects ALIENADO asset ─────────────────────────

  it('Test 4: Transfer rejects ALIENADO asset — returns 400', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTransfer.mockRejectedValue(
      new AssetTransferError('Ativo alienado nao pode ser transferido', 400),
    );

    const res = await request(app)
      .post(`${BASE}/${ASSET_ID}/transfer`)
      .set('Authorization', 'Bearer token')
      .send({
        toFarmId: 'farm-2',
        transferDate: '2026-04-25',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('alienado');
  });

  // ─── Test 5: Transfer rejects non-existent asset ──────────────────────

  it('Test 5: Transfer rejects non-existent asset — returns 404', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTransfer.mockRejectedValue(
      new AssetTransferError('Ativo nao encontrado', 404),
    );

    const res = await request(app)
      .post(`${BASE}/non-existent/transfer`)
      .set('Authorization', 'Bearer token')
      .send({
        toFarmId: 'farm-2',
        transferDate: '2026-04-25',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('encontrado');
  });

  // ─── Test 6: GET /:assetId/transfers returns history ordered by date desc ─

  it('Test 6: GET /:assetId/transfers returns transfer history ordered by transferDate desc', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listTransfers.mockResolvedValue({
      data: [TRANSFER_OUTPUT],
      total: 1,
    });

    const res = await request(app)
      .get(`${BASE}/${ASSET_ID}/transfers`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].assetId).toBe(ASSET_ID);
  });

  // ─── Test 7: Transfer history is empty for asset with no transfers ────

  it('Test 7: Transfer history is empty for asset with no transfers — returns 200 with empty array', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listTransfers.mockResolvedValue({
      data: [],
      total: 0,
    });

    const res = await request(app)
      .get(`${BASE}/${ASSET_ID}/transfers`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});
