/**
 * US-097: Conversão automática em compras e NF de entrada
 * Tests the purchase-to-stock unit conversion integrated into stock entry creation.
 */
import request from 'supertest';
import { app } from '../../app';
import * as stockEntriesService from './stock-entries.service';
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

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

function setupAuth(payload = ADMIN_PAYLOAD) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Fixtures ───────────────────────────────────────────────────────

const ENTRY_ITEM_WITH_CONVERSION = {
  id: 'item-1',
  productId: 'prod-1',
  productName: 'Calcário Dolomítico',
  quantity: 5,
  unitCost: 200,
  totalCost: 1000,
  batchNumber: null as string | null,
  manufacturingDate: null as string | null,
  expirationDate: null as string | null,
  apportionedExpenses: 0,
  finalUnitCost: 200,
  finalTotalCost: 1000,
  weightKg: null as number | null,
  purchaseUnitAbbreviation: 't' as string | null,
  stockQuantity: 5000 as number | null,
  stockUnitAbbreviation: 'kg' as string | null,
  conversionFactor: 1000 as number | null,
};

const ENTRY_ITEM_WITHOUT_CONVERSION = {
  id: 'item-2',
  productId: 'prod-2',
  productName: 'Roundup Original',
  quantity: 100,
  unitCost: 50,
  totalCost: 5000,
  batchNumber: 'LOT-001' as string | null,
  manufacturingDate: '2026-01-01T00:00:00.000Z' as string | null,
  expirationDate: '2027-01-01T00:00:00.000Z' as string | null,
  apportionedExpenses: 0,
  finalUnitCost: 50,
  finalTotalCost: 5000,
  weightKg: null as number | null,
  purchaseUnitAbbreviation: null as string | null,
  stockQuantity: null as number | null,
  stockUnitAbbreviation: null as string | null,
  conversionFactor: null as number | null,
};

const makeEntry = (items = [ENTRY_ITEM_WITH_CONVERSION]) => ({
  id: 'entry-1',
  entryDate: '2026-03-12T00:00:00.000Z',
  status: 'CONFIRMED' as const,
  supplierName: 'Fornecedor ABC',
  invoiceNumber: 'NF-1234',
  storageFarmId: 'farm-1',
  storageFarmName: 'Fazenda Sol',
  storageLocation: 'Galpão 1',
  storageSublocation: null,
  notes: null,
  totalMerchandiseCost: items.reduce((s, i) => s + i.totalCost, 0),
  totalExpensesCost: 0,
  totalCost: items.reduce((s, i) => s + i.totalCost, 0),
  items,
  expenses: [],
  createdAt: '2026-03-12T10:00:00.000Z',
  updatedAt: '2026-03-12T10:00:00.000Z',
});

// ─── Tests ──────────────────────────────────────────────────────────

describe('US-097: Stock Entry Unit Conversion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  describe('POST /api/org/stock-entries — with purchaseUnitAbbreviation', () => {
    it('should accept purchaseUnitAbbreviation in item input', async () => {
      const entry = makeEntry();
      mockedService.createStockEntry.mockResolvedValue({ entry, costAlerts: [] });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [
            {
              productId: 'prod-1',
              quantity: 5,
              unitCost: 200,
              purchaseUnitAbbreviation: 't',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(mockedService.createStockEntry).toHaveBeenCalledTimes(1);

      // Verify input was passed through
      const serviceInput = mockedService.createStockEntry.mock.calls[0][1];
      expect(serviceInput.items[0].purchaseUnitAbbreviation).toBe('t');
    });

    it('should return conversion fields in response item', async () => {
      const entry = makeEntry();
      mockedService.createStockEntry.mockResolvedValue({ entry, costAlerts: [] });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [
            { productId: 'prod-1', quantity: 5, unitCost: 200, purchaseUnitAbbreviation: 't' },
          ],
        });

      expect(res.status).toBe(201);
      // Response is { ...entry, costAlerts } — items at top level
      const item = res.body.items[0];
      expect(item.purchaseUnitAbbreviation).toBe('t');
      expect(item.stockQuantity).toBe(5000);
      expect(item.stockUnitAbbreviation).toBe('kg');
      expect(item.conversionFactor).toBe(1000);
    });

    it('should work without purchaseUnitAbbreviation (backward compatible)', async () => {
      const entry = makeEntry([ENTRY_ITEM_WITHOUT_CONVERSION]);
      mockedService.createStockEntry.mockResolvedValue({ entry, costAlerts: [] });

      const res = await request(app)
        .post('/api/org/stock-entries')
        .set('Authorization', 'Bearer token')
        .send({
          items: [{ productId: 'prod-2', quantity: 100, unitCost: 50 }],
        });

      expect(res.status).toBe(201);
      const item = res.body.items[0];
      expect(item.purchaseUnitAbbreviation).toBeNull();
      expect(item.stockQuantity).toBeNull();
      expect(item.stockUnitAbbreviation).toBeNull();
      expect(item.conversionFactor).toBeNull();
    });
  });

  describe('GET /api/org/stock-entries/:id — conversion fields', () => {
    it('should include conversion fields in entry detail', async () => {
      const entry = makeEntry([ENTRY_ITEM_WITH_CONVERSION, ENTRY_ITEM_WITHOUT_CONVERSION]);
      mockedService.getStockEntry.mockResolvedValue(entry);

      const res = await request(app)
        .get('/api/org/stock-entries/entry-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);

      // Item with conversion
      const converted = res.body.items[0];
      expect(converted.purchaseUnitAbbreviation).toBe('t');
      expect(converted.stockQuantity).toBe(5000);
      expect(converted.stockUnitAbbreviation).toBe('kg');

      // Item without conversion
      const plain = res.body.items[1];
      expect(plain.purchaseUnitAbbreviation).toBeNull();
      expect(plain.stockQuantity).toBeNull();
    });
  });

  describe('POST /api/org/stock-entries/:id/cancel — uses stockQuantity for revert', () => {
    it('should cancel entry with conversion fields present', async () => {
      const entry = { ...makeEntry(), status: 'CANCELLED' as const };
      mockedService.cancelStockEntry.mockResolvedValue(entry);

      const res = await request(app)
        .post('/api/org/stock-entries/entry-1/cancel')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.cancelStockEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/org/stock-entries — list with conversion info', () => {
    it('should include conversion fields in listed entries', async () => {
      const entry = makeEntry([ENTRY_ITEM_WITH_CONVERSION]);
      mockedService.listStockEntries.mockResolvedValue({
        data: [entry],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/org/stock-entries')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data[0].items[0].stockQuantity).toBe(5000);
      expect(res.body.data[0].items[0].purchaseUnitAbbreviation).toBe('t');
    });
  });
});
