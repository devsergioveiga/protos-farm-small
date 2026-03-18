import request from 'supertest';
import { app } from '../../app';
import * as stockInventoriesService from './stock-inventories.service';
import { StockInventoryError } from './stock-inventories.types';
import * as authService from '../auth/auth.service';

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

jest.mock('./stock-inventories.service', () => {
  const actual = jest.requireActual('./stock-inventories.service');
  return {
    ...actual,
    createInventory: jest.fn(),
    recordCount: jest.fn(),
    reconcileInventory: jest.fn(),
    listInventories: jest.fn(),
    getInventory: jest.fn(),
    cancelInventory: jest.fn(),
    getInventoryReport: jest.fn(),
    getInventoryReportCSV: jest.fn(),
    checkActiveInventoryWarning: jest.fn(),
  };
});

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(stockInventoriesService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const VIEWER_PAYLOAD = {
  userId: 'viewer-1',
  email: 'viewer@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Fixtures ───────────────────────────────────────────────────────

const INVENTORY_ITEM = {
  id: 'item-1',
  productId: 'prod-1',
  productName: 'Roundup Original',
  productType: 'defensivo_herbicida',
  measurementUnit: 'L',
  batchNumber: null,
  systemQuantity: 100,
  countedQuantity: null,
  variance: null,
  reason: null,
};

const INVENTORY_RESPONSE = {
  id: 'inv-1',
  inventoryDate: '2026-03-12T00:00:00.000Z',
  status: 'OPEN' as const,
  statusLabel: 'Aberto',
  storageFarmId: null,
  storageFarmName: null,
  storageLocation: null,
  notes: null,
  reconciledAt: null,
  reconciledBy: null,
  createdBy: 'admin@org.com',
  items: [INVENTORY_ITEM],
  itemCount: 1,
  countedCount: 0,
  divergenceCount: 0,
  createdAt: '2026-03-12T00:00:00.000Z',
  updatedAt: '2026-03-12T00:00:00.000Z',
};

const RECONCILE_RESPONSE = {
  inventory: { ...INVENTORY_RESPONSE, status: 'RECONCILED' as const, statusLabel: 'Conciliado' },
  adjustments: [
    {
      id: 'adj-1',
      stockInventoryId: 'inv-1',
      productId: 'prod-1',
      productName: 'Roundup Original',
      adjustmentType: 'INVENTORY_SHORTAGE' as const,
      adjustmentTypeLabel: 'Falta (saída de ajuste)',
      previousQuantity: 100,
      newQuantity: 95,
      adjustmentQty: 5,
      reason: 'Evaporação',
      createdBy: 'admin@org.com',
      createdAt: '2026-03-12T00:00:00.000Z',
    },
  ],
  summary: {
    totalItems: 1,
    countedItems: 1,
    matchCount: 0,
    surplusCount: 0,
    shortageCount: 1,
    totalSurplusValue: 0,
    totalShortageValue: 250,
  },
};

// ─── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/org/stock-inventories', () => {
  it('should create an inventory (201)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createInventory.mockResolvedValue(INVENTORY_RESPONSE);

    const res = await request(app)
      .post('/api/org/stock-inventories')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('inv-1');
    expect(res.body.status).toBe('OPEN');
    expect(res.body.itemCount).toBe(1);
  });

  it('should return 409 when active inventory exists', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createInventory.mockRejectedValue(
      new StockInventoryError('Já existe um inventário em andamento.', 409),
    );

    const res = await request(app)
      .post('/api/org/stock-inventories')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(409);
  });

  it('should return 403 for CONSULTANT role', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .post('/api/org/stock-inventories')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(403);
  });
});

describe('GET /api/org/stock-inventories', () => {
  it('should list inventories', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listInventories.mockResolvedValue({
      data: [INVENTORY_RESPONSE],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const res = await request(app)
      .get('/api/org/stock-inventories')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('should filter by status', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listInventories.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const res = await request(app)
      .get('/api/org/stock-inventories?status=RECONCILED')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listInventories).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ status: 'RECONCILED' }),
    );
  });

  it('should allow CONSULTANT to list', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listInventories.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const res = await request(app)
      .get('/api/org/stock-inventories')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
  });
});

describe('GET /api/org/stock-inventories/:id', () => {
  it('should return inventory by id', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getInventory.mockResolvedValue(INVENTORY_RESPONSE);

    const res = await request(app)
      .get('/api/org/stock-inventories/inv-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('inv-1');
  });

  it('should return 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getInventory.mockRejectedValue(
      new StockInventoryError('Inventário não encontrado.', 404),
    );

    const res = await request(app)
      .get('/api/org/stock-inventories/bad-id')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/org/stock-inventories/:id/count', () => {
  it('should record count', async () => {
    authAs(ADMIN_PAYLOAD);
    const counted = {
      ...INVENTORY_RESPONSE,
      status: 'IN_PROGRESS' as const,
      statusLabel: 'Em andamento',
      items: [{ ...INVENTORY_ITEM, countedQuantity: 95, variance: -5, reason: 'Evaporação' }],
      countedCount: 1,
      divergenceCount: 1,
    };
    mockedService.recordCount.mockResolvedValue(counted);

    const res = await request(app)
      .post('/api/org/stock-inventories/inv-1/count')
      .set('Authorization', 'Bearer token')
      .send({
        items: [{ productId: 'prod-1', countedQuantity: 95, reason: 'Evaporação' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.items[0].countedQuantity).toBe(95);
    expect(res.body.items[0].variance).toBe(-5);
  });

  it('should return 400 for negative count', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.recordCount.mockRejectedValue(
      new StockInventoryError('Quantidade contada não pode ser negativa.', 400),
    );

    const res = await request(app)
      .post('/api/org/stock-inventories/inv-1/count')
      .set('Authorization', 'Bearer token')
      .send({ items: [{ productId: 'prod-1', countedQuantity: -1 }] });

    expect(res.status).toBe(400);
  });

  it('should return 400 for reconciled inventory', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.recordCount.mockRejectedValue(
      new StockInventoryError('Inventário já conciliado. Não é possível alterar contagens.', 400),
    );

    const res = await request(app)
      .post('/api/org/stock-inventories/inv-1/count')
      .set('Authorization', 'Bearer token')
      .send({ items: [{ productId: 'prod-1', countedQuantity: 100 }] });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/org/stock-inventories/:id/reconcile', () => {
  it('should reconcile inventory with adjustments', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.reconcileInventory.mockResolvedValue(RECONCILE_RESPONSE);

    const res = await request(app)
      .post('/api/org/stock-inventories/inv-1/reconcile')
      .set('Authorization', 'Bearer token')
      .send({ items: [{ productId: 'prod-1', reason: 'Evaporação' }] });

    expect(res.status).toBe(200);
    expect(res.body.inventory.status).toBe('RECONCILED');
    expect(res.body.adjustments).toHaveLength(1);
    expect(res.body.summary.shortageCount).toBe(1);
    expect(res.body.summary.totalShortageValue).toBe(250);
  });

  it('should return 400 when items not counted', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.reconcileInventory.mockRejectedValue(
      new StockInventoryError('Todos os itens devem ser contados antes da conciliação.', 400),
    );

    const res = await request(app)
      .post('/api/org/stock-inventories/inv-1/reconcile')
      .set('Authorization', 'Bearer token')
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  it('should return 403 for CONSULTANT', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .post('/api/org/stock-inventories/inv-1/reconcile')
      .set('Authorization', 'Bearer token')
      .send({ items: [] });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/org/stock-inventories/:id/cancel', () => {
  it('should cancel an inventory', async () => {
    authAs(ADMIN_PAYLOAD);
    const cancelled = {
      ...INVENTORY_RESPONSE,
      status: 'CANCELLED' as const,
      statusLabel: 'Cancelado',
    };
    mockedService.cancelInventory.mockResolvedValue(cancelled);

    const res = await request(app)
      .patch('/api/org/stock-inventories/inv-1/cancel')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('should return 400 for reconciled inventory', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.cancelInventory.mockRejectedValue(
      new StockInventoryError('Inventário já conciliado. Não é possível cancelar.', 400),
    );

    const res = await request(app)
      .patch('/api/org/stock-inventories/inv-1/cancel')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/org/stock-inventories/:id/report', () => {
  it('should return inventory report with summary', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getInventoryReport.mockResolvedValue(RECONCILE_RESPONSE);

    const res = await request(app)
      .get('/api/org/stock-inventories/inv-1/report')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.summary.totalItems).toBe(1);
    expect(res.body.adjustments).toHaveLength(1);
  });
});

describe('GET /api/org/stock-inventories/:id/report/export', () => {
  it('should return CSV', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getInventoryReportCSV.mockResolvedValue(
      'Produto;Tipo;Unidade;Saldo Sistema;Contagem Física;Diferença;Motivo;Ajuste Aplicado\n"Roundup";defensivo;L;100;95;-5;"Evaporação";Sim',
    );

    const res = await request(app)
      .get('/api/org/stock-inventories/inv-1/report/export')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Roundup');
  });
});

describe('GET /api/org/stock-inventories/check-active', () => {
  it('should return active inventory warning', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.checkActiveInventoryWarning.mockResolvedValue({
      hasActiveInventory: true,
      inventoryId: 'inv-1',
    });

    const res = await request(app)
      .get('/api/org/stock-inventories/check-active?productId=prod-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.hasActiveInventory).toBe(true);
    expect(res.body.inventoryId).toBe('inv-1');
  });

  it('should return false when no active inventory', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.checkActiveInventoryWarning.mockResolvedValue({
      hasActiveInventory: false,
    });

    const res = await request(app)
      .get('/api/org/stock-inventories/check-active?productId=prod-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.hasActiveInventory).toBe(false);
  });

  it('should return 400 without productId', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .get('/api/org/stock-inventories/check-active')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });
});
