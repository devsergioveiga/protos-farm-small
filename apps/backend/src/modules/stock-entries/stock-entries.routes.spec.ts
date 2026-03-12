import request from 'supertest';
import { app } from '../../app';
import * as stockEntriesService from './stock-entries.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { StockEntryError } from './stock-entries.types';

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

jest.mock('./stock-entries.service', () => ({
  createStockEntry: jest.fn(),
  listStockEntries: jest.fn(),
  getStockEntry: jest.fn(),
  cancelStockEntry: jest.fn(),
  addRetroactiveExpense: jest.fn(),
  listStockBalances: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(stockEntriesService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

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

const ENTRY_ITEM = {
  id: 'item-1',
  productId: 'prod-1',
  productName: 'Roundup Original',
  quantity: 100,
  unitCost: 50,
  totalCost: 5000,
  batchNumber: 'LOT-001',
  manufacturingDate: '2026-01-01T00:00:00.000Z',
  expirationDate: '2027-01-01T00:00:00.000Z',
  apportionedExpenses: 100,
  finalUnitCost: 51,
  finalTotalCost: 5100,
  weightKg: null,
};

const ENTRY_EXPENSE = {
  id: 'exp-1',
  expenseType: 'FREIGHT' as const,
  expenseTypeLabel: 'Frete',
  description: null,
  supplierName: 'Transportadora X',
  invoiceNumber: 'CTE-5678',
  amount: 100,
  apportionmentMethod: 'BY_VALUE' as const,
  isRetroactive: false,
};

const STOCK_ENTRY = {
  id: 'entry-1',
  entryDate: '2026-03-12T00:00:00.000Z',
  status: 'CONFIRMED' as const,
  supplierName: 'Fornecedor A',
  invoiceNumber: 'NF-1234',
  storageFarmId: 'farm-1',
  storageFarmName: 'Fazenda São João',
  storageLocation: 'Galpão 1',
  storageSublocation: 'Prateleira A',
  notes: null,
  totalMerchandiseCost: 5000,
  totalExpensesCost: 100,
  totalCost: 5100,
  items: [ENTRY_ITEM],
  expenses: [ENTRY_EXPENSE],
  createdAt: '2026-03-12T00:00:00.000Z',
  updatedAt: '2026-03-12T00:00:00.000Z',
};

const STOCK_BALANCE = {
  id: 'bal-1',
  productId: 'prod-1',
  productName: 'Roundup Original',
  productType: 'defensivo_herbicida',
  measurementUnit: 'L',
  currentQuantity: 100,
  averageCost: 51,
  totalValue: 5100,
  lastEntryDate: '2026-03-12T00:00:00.000Z',
};

// ─── Tests ──────────────────────────────────────────────────────────

describe('Stock Entries Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── POST /org/stock-entries ────────────────────────────────────

  describe('POST /api/org/stock-entries', () => {
    const validBody = {
      supplierName: 'Fornecedor A',
      invoiceNumber: 'NF-1234',
      storageFarmId: 'farm-1',
      storageLocation: 'Galpão 1',
      items: [
        {
          productId: 'prod-1',
          quantity: 100,
          unitCost: 50,
          batchNumber: 'LOT-001',
          manufacturingDate: '2026-01-01',
          expirationDate: '2027-01-01',
        },
      ],
      expenses: [
        {
          expenseType: 'FREIGHT',
          supplierName: 'Transportadora X',
          invoiceNumber: 'CTE-5678',
          amount: 100,
          apportionmentMethod: 'BY_VALUE',
        },
      ],
    };

    it('should create a stock entry (201)', async () => {
      mockedService.createStockEntry.mockResolvedValue({
        entry: STOCK_ENTRY,
        costAlerts: [],
      });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('entry-1');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.expenses).toHaveLength(1);
      expect(res.body.costAlerts).toEqual([]);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_STOCK_ENTRY' }),
      );
    });

    it('should return cost alerts when divergence > 20%', async () => {
      const alerts = [
        {
          productId: 'prod-1',
          productName: 'Roundup Original',
          currentAvgCost: 40,
          newUnitCost: 55,
          divergencePct: 37.5,
        },
      ];
      mockedService.createStockEntry.mockResolvedValue({
        entry: STOCK_ENTRY,
        costAlerts: alerts,
      });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.costAlerts).toHaveLength(1);
      expect(res.body.costAlerts[0].divergencePct).toBe(37.5);
    });

    it('should reject service products (400)', async () => {
      mockedService.createStockEntry.mockRejectedValue(
        new StockEntryError('"Consultoria" é um serviço e não pode ter entrada no estoque', 400),
      );

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [{ productId: 'svc-1', quantity: 1, unitCost: 100 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('serviço');
    });

    it('should reject empty items (400)', async () => {
      mockedService.createStockEntry.mockRejectedValue(
        new StockEntryError('Pelo menos um item é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({ items: [] });

      expect(res.status).toBe(400);
    });

    it('should reject quantity <= 0 (400)', async () => {
      mockedService.createStockEntry.mockRejectedValue(
        new StockEntryError('Quantidade deve ser maior que zero', 400),
      );

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [{ productId: 'prod-1', quantity: 0, unitCost: 50 }],
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).post('/api/org/stock-entries').send(validBody);

      expect(res.status).toBe(401);
    });

    it('should return 403 for CONSULTANT role', async () => {
      authAs(VIEWER_PAYLOAD);

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('should reject product not found (404)', async () => {
      mockedService.createStockEntry.mockRejectedValue(
        new StockEntryError('Produto não encontrado: prod-999', 404),
      );

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [{ productId: 'prod-999', quantity: 10, unitCost: 50 }],
        });

      expect(res.status).toBe(404);
    });

    it('should handle multiple items (CA7)', async () => {
      const multiItemEntry = {
        ...STOCK_ENTRY,
        items: [
          { ...ENTRY_ITEM, id: 'item-1', productId: 'prod-1' },
          { ...ENTRY_ITEM, id: 'item-2', productId: 'prod-2', productName: 'Adubo NPK' },
        ],
        totalMerchandiseCost: 10000,
        totalCost: 10100,
      };
      mockedService.createStockEntry.mockResolvedValue({
        entry: multiItemEntry,
        costAlerts: [],
      });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          ...validBody,
          items: [
            { productId: 'prod-1', quantity: 100, unitCost: 50 },
            { productId: 'prod-2', quantity: 100, unitCost: 50 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(2);
    });

    it('should handle entry with storage location (CA8)', async () => {
      mockedService.createStockEntry.mockResolvedValue({
        entry: STOCK_ENTRY,
        costAlerts: [],
      });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          ...validBody,
          storageFarmId: 'farm-1',
          storageLocation: 'Galpão 1',
          storageSublocation: 'Prateleira A',
        });

      expect(res.status).toBe(201);
      expect(res.body.storageFarmId).toBe('farm-1');
      expect(res.body.storageLocation).toBe('Galpão 1');
    });
  });

  // ─── GET /org/stock-entries ─────────────────────────────────────

  describe('GET /api/org/stock-entries', () => {
    it('should list entries with pagination', async () => {
      mockedService.listStockEntries.mockResolvedValue({
        data: [STOCK_ENTRY],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/org/stock-entries')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockedService.listStockEntries.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-entries?status=CONFIRMED')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockEntries).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ status: 'CONFIRMED' }),
      );
    });

    it('should filter by date range', async () => {
      mockedService.listStockEntries.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-entries?dateFrom=2026-01-01&dateTo=2026-12-31')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockEntries).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ dateFrom: '2026-01-01', dateTo: '2026-12-31' }),
      );
    });

    it('should filter by product', async () => {
      mockedService.listStockEntries.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-entries?productId=prod-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockEntries).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ productId: 'prod-1' }),
      );
    });

    it('should filter by supplier name', async () => {
      mockedService.listStockEntries.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-entries?supplierName=Fornecedor')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockEntries).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ supplierName: 'Fornecedor' }),
      );
    });

    it('should allow CONSULTANT to read', async () => {
      authAs(VIEWER_PAYLOAD);
      mockedService.listStockEntries.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-entries')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });
  });

  // ─── GET /org/stock-entries/:id ─────────────────────────────────

  describe('GET /api/org/stock-entries/:id', () => {
    it('should return a single entry', async () => {
      mockedService.getStockEntry.mockResolvedValue(STOCK_ENTRY);

      const res = await request(app)
        .get('/api/org/stock-entries/entry-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('entry-1');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.expenses).toHaveLength(1);
    });

    it('should return 404 for missing entry', async () => {
      mockedService.getStockEntry.mockRejectedValue(
        new StockEntryError('Entrada não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/stock-entries/not-found')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /org/stock-entries/:id/expenses (CA6) ─────────────────

  describe('POST /api/org/stock-entries/:id/expenses', () => {
    const expenseBody = {
      expenseType: 'FREIGHT',
      supplierName: 'Transportadora Y',
      invoiceNumber: 'CTE-9999',
      amount: 500,
      apportionmentMethod: 'BY_VALUE',
    };

    it('should add retroactive expense', async () => {
      const updatedEntry = {
        ...STOCK_ENTRY,
        totalExpensesCost: 600,
        totalCost: 5600,
        expenses: [
          ENTRY_EXPENSE,
          {
            ...ENTRY_EXPENSE,
            id: 'exp-2',
            supplierName: 'Transportadora Y',
            invoiceNumber: 'CTE-9999',
            amount: 500,
            isRetroactive: true,
          },
        ],
      };
      mockedService.addRetroactiveExpense.mockResolvedValue(updatedEntry);

      const res = await request(app)
        .post('/api/org/stock-entries/entry-1/expenses')
        .set('Authorization', 'Bearer token')
        .send(expenseBody);

      expect(res.status).toBe(200);
      expect(res.body.totalExpensesCost).toBe(600);
      expect(res.body.expenses).toHaveLength(2);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADD_STOCK_ENTRY_EXPENSE',
          metadata: expect.objectContaining({ isRetroactive: true }),
        }),
      );
    });

    it('should reject adding expense to cancelled entry (400)', async () => {
      mockedService.addRetroactiveExpense.mockRejectedValue(
        new StockEntryError('Não é possível adicionar despesa a uma entrada cancelada', 400),
      );

      const res = await request(app)
        .post('/api/org/stock-entries/entry-1/expenses')
        .set('Authorization', 'Bearer token')
        .send(expenseBody);

      expect(res.status).toBe(400);
    });

    it('should reject invalid expense type (400)', async () => {
      mockedService.addRetroactiveExpense.mockRejectedValue(
        new StockEntryError('Tipo de despesa inválido', 400),
      );

      const res = await request(app)
        .post('/api/org/stock-entries/entry-1/expenses')
        .set('Authorization', 'Bearer token')
        .send({ ...expenseBody, expenseType: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('should return 403 for CONSULTANT', async () => {
      authAs(VIEWER_PAYLOAD);

      const res = await request(app)
        .post('/api/org/stock-entries/entry-1/expenses')
        .set('Authorization', 'Bearer token')
        .send(expenseBody);

      expect(res.status).toBe(403);
    });
  });

  // ─── POST /org/stock-entries/:id/cancel ─────────────────────────

  describe('POST /api/org/stock-entries/:id/cancel', () => {
    it('should cancel entry and revert balances', async () => {
      const cancelledEntry = { ...STOCK_ENTRY, status: 'CANCELLED' as const };
      mockedService.cancelStockEntry.mockResolvedValue(cancelledEntry);

      const res = await request(app)
        .post('/api/org/stock-entries/entry-1/cancel')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CANCEL_STOCK_ENTRY' }),
      );
    });

    it('should reject cancelling already cancelled entry (400)', async () => {
      mockedService.cancelStockEntry.mockRejectedValue(
        new StockEntryError('Entrada já está cancelada', 400),
      );

      const res = await request(app)
        .post('/api/org/stock-entries/entry-1/cancel')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
    });

    it('should return 404 for missing entry', async () => {
      mockedService.cancelStockEntry.mockRejectedValue(
        new StockEntryError('Entrada não encontrada', 404),
      );

      const res = await request(app)
        .post('/api/org/stock-entries/not-found/cancel')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /org/stock-balances ────────────────────────────────────

  describe('GET /api/org/stock-balances', () => {
    it('should list stock balances', async () => {
      mockedService.listStockBalances.mockResolvedValue({
        data: [STOCK_BALANCE],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/org/stock-balances')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].productName).toBe('Roundup Original');
      expect(res.body.data[0].currentQuantity).toBe(100);
      expect(res.body.data[0].averageCost).toBe(51);
    });

    it('should search by product name', async () => {
      mockedService.listStockBalances.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-balances?search=Roundup')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockBalances).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ search: 'Roundup' }),
      );
    });

    it('should allow CONSULTANT to read balances', async () => {
      authAs(VIEWER_PAYLOAD);
      mockedService.listStockBalances.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-balances')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });
  });

  // ─── Apportionment Methods (CA3/CA4) ────────────────────────────

  describe('Apportionment methods in create', () => {
    it('should accept BY_QUANTITY apportionment', async () => {
      mockedService.createStockEntry.mockResolvedValue({
        entry: STOCK_ENTRY,
        costAlerts: [],
      });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [{ productId: 'prod-1', quantity: 50, unitCost: 100 }],
          expenses: [{ expenseType: 'FREIGHT', amount: 200, apportionmentMethod: 'BY_QUANTITY' }],
        });

      expect(res.status).toBe(201);
    });

    it('should accept BY_WEIGHT apportionment', async () => {
      mockedService.createStockEntry.mockResolvedValue({
        entry: STOCK_ENTRY,
        costAlerts: [],
      });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [{ productId: 'prod-1', quantity: 50, unitCost: 100, weightKg: 1000 }],
          expenses: [{ expenseType: 'INSURANCE', amount: 500, apportionmentMethod: 'BY_WEIGHT' }],
        });

      expect(res.status).toBe(201);
    });

    it('should accept FIXED apportionment', async () => {
      mockedService.createStockEntry.mockResolvedValue({
        entry: STOCK_ENTRY,
        costAlerts: [],
      });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [{ productId: 'prod-1', quantity: 50, unitCost: 100 }],
          expenses: [{ expenseType: 'UNLOADING', amount: 300, apportionmentMethod: 'FIXED' }],
        });

      expect(res.status).toBe(201);
    });
  });

  // ─── Expense Types ──────────────────────────────────────────────

  describe('All expense types', () => {
    const expenseTypes = [
      'FREIGHT',
      'INSURANCE',
      'UNLOADING',
      'TOLL',
      'TEMPORARY_STORAGE',
      'PACKAGING',
      'PORT_FEE',
      'ICMS_ST',
      'IPI',
      'OTHER',
    ];

    it.each(expenseTypes)('should accept expense type %s', async (type) => {
      mockedService.createStockEntry.mockResolvedValue({
        entry: STOCK_ENTRY,
        costAlerts: [],
      });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [{ productId: 'prod-1', quantity: 10, unitCost: 50 }],
          expenses: [{ expenseType: type, amount: 100 }],
        });

      expect(res.status).toBe(201);
    });
  });

  // ─── Internal server error handling ─────────────────────────────

  describe('Error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockedService.createStockEntry.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [{ productId: 'prod-1', quantity: 10, unitCost: 50 }],
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });
  });
});
