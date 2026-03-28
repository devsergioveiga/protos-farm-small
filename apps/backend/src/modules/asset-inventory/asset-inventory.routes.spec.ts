import request from 'supertest';
import { app } from '../../app';
import * as inventoryService from './asset-inventory.service';
import * as authService from '../auth/auth.service';
import { AssetInventoryError } from './asset-inventory.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-inventory.service', () => ({
  createInventory: jest.fn(),
  listInventories: jest.fn(),
  getInventory: jest.fn(),
  countItems: jest.fn(),
  reconcileInventory: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(inventoryService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';
const FARM_ID = 'farm-1';
const INV_ID = 'inv-1';

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

// ─── Fixtures ──────────────────────────────────────────────────────────

const INVENTORY_ITEM = {
  id: 'item-1',
  assetId: 'asset-1',
  assetTag: 'PAT-00001',
  assetName: 'Trator John Deere',
  assetType: 'MAQUINA',
  registeredStatus: 'ATIVO',
  physicalStatus: null,
  physicalStatusLabel: null,
  notes: null,
};

const INVENTORY_OUTPUT = {
  id: INV_ID,
  farmId: FARM_ID,
  farmName: 'Fazenda A',
  status: 'DRAFT',
  statusLabel: 'Rascunho',
  notes: null,
  reconciledAt: null,
  reconciledBy: null,
  items: [INVENTORY_ITEM],
  itemCount: 1,
  countedCount: 0,
  divergenceCount: 0,
  createdBy: 'manager-1',
  createdAt: '2026-04-25T10:00:00.000Z',
  updatedAt: '2026-04-25T10:00:00.000Z',
};

const BASE = `/api/org/${ORG_ID}/asset-inventories`;

// ─── Tests ────────────────────────────────────────────────────────────

describe('Asset Inventory API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Test 1: POST creates inventory in DRAFT with ATIVO assets ────────

  it('Test 1: POST creates inventory in DRAFT status, auto-loads ATIVO assets — returns 201', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createInventory.mockResolvedValue(INVENTORY_OUTPUT);

    const res = await request(app)
      .post(BASE)
      .set('Authorization', 'Bearer token')
      .send({ notes: 'Inventario anual' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.items).toHaveLength(1);
    expect(mockedService.createInventory).toHaveBeenCalledTimes(1);
  });

  // ─── Test 2: POST with farmId filters to that farm only ──────────────

  it('Test 2: POST with farmId filters assets to that farm only', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createInventory.mockResolvedValue(INVENTORY_OUTPUT);

    const res = await request(app)
      .post(BASE)
      .set('Authorization', 'Bearer token')
      .send({ farmId: FARM_ID });

    expect(res.status).toBe(201);
    expect(mockedService.createInventory).toHaveBeenCalledWith(
      { organizationId: ORG_ID },
      expect.objectContaining({ farmId: FARM_ID }),
      'manager-1',
    );
  });

  // ─── Test 3: PATCH /:id/count updates items, transitions to COUNTING ──

  it('Test 3: PATCH /:id/count updates items physicalStatus, transitions to COUNTING — returns 200', async () => {
    authAs(MANAGER_PAYLOAD);
    const countingOutput = {
      ...INVENTORY_OUTPUT,
      status: 'COUNTING',
      statusLabel: 'Em contagem',
      items: [{ ...INVENTORY_ITEM, physicalStatus: 'ENCONTRADO', physicalStatusLabel: 'Encontrado' }],
      countedCount: 1,
    };
    mockedService.countItems.mockResolvedValue(countingOutput);

    const res = await request(app)
      .patch(`${BASE}/${INV_ID}/count`)
      .set('Authorization', 'Bearer token')
      .send({ items: [{ assetId: 'asset-1', physicalStatus: 'ENCONTRADO' }] });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COUNTING');
    expect(mockedService.countItems).toHaveBeenCalledWith(
      { organizationId: ORG_ID },
      INV_ID,
      [{ assetId: 'asset-1', physicalStatus: 'ENCONTRADO' }],
    );
  });

  // ─── Test 4: Count rejects RECONCILED inventory ───────────────────────

  it('Test 4: Count rejects inventory in RECONCILED status — returns 400', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.countItems.mockRejectedValue(
      new AssetInventoryError('Inventario ja foi conciliado ou cancelado', 400),
    );

    const res = await request(app)
      .patch(`${BASE}/${INV_ID}/count`)
      .set('Authorization', 'Bearer token')
      .send({ items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('conciliado');
  });

  // ─── Test 5: POST reconcile transitions to RECONCILED ─────────────────

  it('Test 5: POST /:id/reconcile transitions to RECONCILED, sets reconciledAt — returns 200', async () => {
    authAs(MANAGER_PAYLOAD);
    const reconciledOutput = {
      ...INVENTORY_OUTPUT,
      status: 'RECONCILED',
      statusLabel: 'Conciliado',
      reconciledAt: '2026-04-25T11:00:00.000Z',
      reconciledBy: 'manager-1',
    };
    mockedService.reconcileInventory.mockResolvedValue(reconciledOutput);

    const res = await request(app)
      .post(`${BASE}/${INV_ID}/reconcile`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RECONCILED');
    expect(res.body.reconciledAt).toBeTruthy();
  });

  // ─── Test 6: Reconcile rejects DRAFT inventory ───────────────────────

  it('Test 6: Reconcile rejects inventory in DRAFT status — returns 400', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.reconcileInventory.mockRejectedValue(
      new AssetInventoryError('Realize a contagem antes de conciliar', 400),
    );

    const res = await request(app)
      .post(`${BASE}/${INV_ID}/reconcile`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('contagem');
  });

  // ─── Test 7: GET /:id returns full inventory with items ──────────────

  it('Test 7: GET /:id returns full inventory with items', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getInventory.mockResolvedValue(INVENTORY_OUTPUT);

    const res = await request(app)
      .get(`${BASE}/${INV_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(INV_ID);
    expect(res.body.items).toHaveLength(1);
  });

  // ─── Test 8: GET / returns paginated list ────────────────────────────

  it('Test 8: GET / returns paginated list', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listInventories.mockResolvedValue({
      data: [INVENTORY_OUTPUT],
      total: 1,
    });

    const res = await request(app).get(BASE).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  // ─── Test 9: divergenceCount counts non-ENCONTRADO items ─────────────

  it('Test 9: Inventory divergenceCount counts items where physicalStatus != ENCONTRADO', async () => {
    authAs(MANAGER_PAYLOAD);
    const outputWithDivergence = {
      ...INVENTORY_OUTPUT,
      status: 'COUNTING',
      items: [
        { ...INVENTORY_ITEM, id: 'item-1', physicalStatus: 'ENCONTRADO', physicalStatusLabel: 'Encontrado' },
        { ...INVENTORY_ITEM, id: 'item-2', assetId: 'asset-2', physicalStatus: 'NAO_ENCONTRADO', physicalStatusLabel: 'Nao encontrado' },
        { ...INVENTORY_ITEM, id: 'item-3', assetId: 'asset-3', physicalStatus: 'AVARIADO', physicalStatusLabel: 'Avariado' },
      ],
      itemCount: 3,
      countedCount: 3,
      divergenceCount: 2,
    };
    mockedService.getInventory.mockResolvedValue(outputWithDivergence);

    const res = await request(app)
      .get(`${BASE}/${INV_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.divergenceCount).toBe(2);
    expect(res.body.countedCount).toBe(3);
  });
});
