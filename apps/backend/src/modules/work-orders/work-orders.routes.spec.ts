import request from 'supertest';
import { app } from '../../app';
import * as workOrdersService from './work-orders.service';
import * as authService from '../auth/auth.service';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./work-orders.service', () => ({
  createWorkOrder: jest.fn(),
  listWorkOrders: jest.fn(),
  getWorkOrder: jest.fn(),
  updateWorkOrder: jest.fn(),
  addWorkOrderPart: jest.fn(),
  removeWorkOrderPart: jest.fn(),
  closeWorkOrder: jest.fn(),
  cancelWorkOrder: jest.fn(),
  getMaintenanceDashboard: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(workOrdersService);
const mockedAuth = jest.mocked(authService);

// ─── Constants ──────────────────────────────────────────────────────────────

const ORG_ID = 'org-test-1';
const ASSET_ID = 'asset-test-1';
const WO_ID = 'wo-test-1';
const PART_ID = 'part-test-1';
const CC_ID = 'cc-test-1';
const PLAN_ID = 'plan-test-1';

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: ORG_ID,
};

const _OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const VALID_WO = {
  id: WO_ID,
  organizationId: ORG_ID,
  assetId: ASSET_ID,
  sequentialNumber: 1,
  type: 'CORRETIVA',
  status: 'ABERTA',
  title: 'Reparo motor',
  description: null,
  maintenancePlanId: null,
  assignedTo: null,
  openedAt: '2026-01-01T00:00:00.000Z',
  startedAt: null,
  closedAt: null,
  hourmeterAtOpen: 500,
  odometerAtOpen: null,
  laborHours: null,
  laborCostPerHour: null,
  totalPartsCost: null,
  totalLaborCost: null,
  externalCost: null,
  totalCost: null,
  accountingTreatment: null,
  photoUrls: [],
  geoLat: null,
  geoLon: null,
  stockOutputId: null,
  costCenterId: null,
  costCenterMode: 'INHERITED',
  notes: null,
  parts: [],
  ccItems: [],
  asset: { id: ASSET_ID, name: 'Trator John Deere', assetTag: 'PAT-00001' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const CLOSED_WO_DESPESA = {
  ...VALID_WO,
  status: 'ENCERRADA',
  closedAt: '2026-01-15T10:00:00.000Z',
  accountingTreatment: 'DESPESA',
  totalPartsCost: 150,
  totalLaborCost: 200,
  externalCost: 0,
  totalCost: 350,
  ccItems: [
    { id: 'cc-item-1', costCenterId: CC_ID, farmId: 'farm-1', amount: 350, percentage: 100 },
  ],
};

const VALID_DASHBOARD = {
  availability: 95.5,
  mtbfHours: 720,
  mttrHours: 4.5,
  totalCostYTD: 12500,
  openOrdersCount: 3,
  overdueMaintenancesCount: 1,
  byStatus: { ABERTA: 2, EM_ANDAMENTO: 1, ENCERRADA: 5 },
  costByAsset: [{ assetId: ASSET_ID, assetName: 'Trator', totalCost: 5000 }],
  recentOrders: [],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WorkOrders Routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── POST /api/org/:orgId/work-orders ────────────────────────────────────

  describe('POST /api/org/:orgId/work-orders', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('creates work order and sets asset status to EM_MANUTENCAO atomically', async () => {
      mockedService.createWorkOrder.mockResolvedValue(VALID_WO as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/work-orders`)
        .set('Authorization', 'Bearer valid-token')
        .send({ assetId: ASSET_ID, type: 'CORRETIVA', title: 'Reparo motor' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ABERTA');
      expect(mockedService.createWorkOrder).toHaveBeenCalledWith(
        { organizationId: ORG_ID, userId: ADMIN_PAYLOAD.userId },
        expect.objectContaining({ assetId: ASSET_ID, type: 'CORRETIVA', title: 'Reparo motor' }),
      );
    });

    it('assigns sequential number per organization', async () => {
      const woWithSeq = { ...VALID_WO, sequentialNumber: 42 };
      mockedService.createWorkOrder.mockResolvedValue(woWithSeq as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/work-orders`)
        .set('Authorization', 'Bearer valid-token')
        .send({ assetId: ASSET_ID, type: 'CORRETIVA', title: 'Reparo motor' });

      expect(res.status).toBe(201);
      expect(res.body.sequentialNumber).toBe(42);
    });

    it('creates PREVENTIVA OS linked to maintenance plan', async () => {
      const preventivaWo = { ...VALID_WO, type: 'PREVENTIVA', maintenancePlanId: PLAN_ID };
      mockedService.createWorkOrder.mockResolvedValue(preventivaWo as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/work-orders`)
        .set('Authorization', 'Bearer valid-token')
        .send({ assetId: ASSET_ID, type: 'PREVENTIVA', title: 'Revisao preventiva', maintenancePlanId: PLAN_ID });

      expect(res.status).toBe(201);
      expect(mockedService.createWorkOrder).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ maintenancePlanId: PLAN_ID }),
      );
    });

    it('creates SOLICITACAO OS with photo and geolocation', async () => {
      const solicitacaoWo = {
        ...VALID_WO,
        type: 'SOLICITACAO',
        photoUrls: ['url1'],
        geoLat: -22.9,
        geoLon: -43.2,
        assignedTo: 'user-1',
      };
      mockedService.createWorkOrder.mockResolvedValue(solicitacaoWo as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/work-orders`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          assetId: ASSET_ID,
          type: 'SOLICITACAO',
          title: 'Solicitacao manutencao',
          photoUrls: ['url1'],
          geoLat: -22.9,
          geoLon: -43.2,
          assignedTo: 'user-1',
        });

      expect(res.status).toBe(201);
      expect(mockedService.createWorkOrder).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          photoUrls: ['url1'],
          geoLat: -22.9,
          geoLon: -43.2,
          assignedTo: 'user-1',
        }),
      );
    });

    it('returns 400 when required fields missing', async () => {
      const { WorkOrderError } = jest.requireActual('./work-orders.types');
      mockedService.createWorkOrder.mockRejectedValue(
        new WorkOrderError('Campo obrigatorio', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/work-orders`)
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'CORRETIVA' });

      expect(res.status).toBe(400);
    });

    it('returns 403 when user lacks work-orders:create permission', async () => {
      // Use CONSULTANT role which does not have work-orders:create permission
      const consultantPayload = {
        userId: 'consultant-1',
        email: 'consultant@org.com',
        role: 'CONSULTANT' as const,
        organizationId: ORG_ID,
      };
      authAs(consultantPayload);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/work-orders`)
        .set('Authorization', 'Bearer valid-token')
        .send({ assetId: ASSET_ID, type: 'CORRETIVA', title: 'Reparo motor' });

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/org/:orgId/work-orders ────────────────────────────────────

  describe('GET /api/org/:orgId/work-orders', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('lists work orders with pagination', async () => {
      mockedService.listWorkOrders.mockResolvedValue({
        data: [VALID_WO],
        total: 1,
        page: 1,
        limit: 20,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('filters by status', async () => {
      mockedService.listWorkOrders.mockResolvedValue({
        data: [VALID_WO],
        total: 1,
        page: 1,
        limit: 20,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders?status=ABERTA`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listWorkOrders).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ status: 'ABERTA' }),
      );
    });

    it('filters by assetId', async () => {
      mockedService.listWorkOrders.mockResolvedValue({
        data: [VALID_WO],
        total: 1,
        page: 1,
        limit: 20,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders?assetId=${ASSET_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listWorkOrders).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ assetId: ASSET_ID }),
      );
    });

    it('filters by type', async () => {
      mockedService.listWorkOrders.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders?type=CORRETIVA`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listWorkOrders).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ type: 'CORRETIVA' }),
      );
    });

    it('filters by date range', async () => {
      mockedService.listWorkOrders.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders?dateFrom=2026-01-01&dateTo=2026-01-31`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listWorkOrders).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }),
      );
    });
  });

  // ─── GET /api/org/:orgId/work-orders/:id ────────────────────────────────

  describe('GET /api/org/:orgId/work-orders/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns work order with parts, ccItems, and asset', async () => {
      const fullWo = {
        ...VALID_WO,
        parts: [{ id: PART_ID, productId: 'prod-1', quantity: 2, unitCost: 50, totalCost: 100, notes: null }],
        ccItems: [{ id: 'cc-item-1', costCenterId: CC_ID, farmId: 'farm-1', amount: 100, percentage: 100 }],
      };
      mockedService.getWorkOrder.mockResolvedValue(fullWo as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders/${WO_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(WO_ID);
      expect(res.body.parts).toBeDefined();
      expect(res.body.ccItems).toBeDefined();
      expect(res.body.asset).toBeDefined();
    });

    it('returns 404 when work order not found', async () => {
      const { WorkOrderError } = jest.requireActual('./work-orders.types');
      mockedService.getWorkOrder.mockRejectedValue(
        new WorkOrderError('OS nao encontrada', 404),
      );

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders/non-existent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });
  });

  // ─── PATCH /api/org/:orgId/work-orders/:id ───────────────────────────────

  describe('PATCH /api/org/:orgId/work-orders/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('updates status to EM_ANDAMENTO', async () => {
      const updatedWo = { ...VALID_WO, status: 'EM_ANDAMENTO', startedAt: '2026-01-05T08:00:00.000Z' };
      mockedService.updateWorkOrder.mockResolvedValue(updatedWo as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'EM_ANDAMENTO' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EM_ANDAMENTO');
    });

    it('updates status to AGUARDANDO_PECA', async () => {
      const updatedWo = { ...VALID_WO, status: 'AGUARDANDO_PECA' };
      mockedService.updateWorkOrder.mockResolvedValue(updatedWo as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'AGUARDANDO_PECA' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('AGUARDANDO_PECA');
    });

    it('updates title and description', async () => {
      const updatedWo = { ...VALID_WO, title: 'Novo titulo', description: 'Nova desc' };
      mockedService.updateWorkOrder.mockResolvedValue(updatedWo as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ title: 'Novo titulo', description: 'Nova desc' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Novo titulo');
      expect(res.body.description).toBe('Nova desc');
    });
  });

  // ─── POST /api/org/:orgId/work-orders/:id/parts ──────────────────────────

  describe('POST /api/org/:orgId/work-orders/:id/parts', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('adds part to work order and updates totalPartsCost', async () => {
      const woWithParts = {
        ...VALID_WO,
        totalPartsCost: 150,
        parts: [
          {
            id: PART_ID,
            productId: 'prod-1',
            quantity: 3,
            unitCost: 50,
            totalCost: 150,
            notes: null,
          },
        ],
      };
      mockedService.addWorkOrderPart.mockResolvedValue(woWithParts as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/work-orders/${WO_ID}/parts`)
        .set('Authorization', 'Bearer valid-token')
        .send({ productId: 'prod-1', quantity: 3, unitCost: 50 });

      expect(res.status).toBe(201);
      expect(res.body.totalPartsCost).toBe(150);
      expect(mockedService.addWorkOrderPart).toHaveBeenCalledWith(
        expect.any(Object),
        WO_ID,
        expect.objectContaining({ productId: 'prod-1', quantity: 3, unitCost: 50 }),
      );
    });

    it('returns 400 when product not found', async () => {
      const { WorkOrderError } = jest.requireActual('./work-orders.types');
      mockedService.addWorkOrderPart.mockRejectedValue(
        new WorkOrderError('Produto nao encontrado', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/work-orders/${WO_ID}/parts`)
        .set('Authorization', 'Bearer valid-token')
        .send({ productId: 'non-existent', quantity: 1, unitCost: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });
  });

  // ─── DELETE /api/org/:orgId/work-orders/:id/parts/:partId ───────────────

  describe('DELETE /api/org/:orgId/work-orders/:id/parts/:partId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('removes part and recalculates totalPartsCost', async () => {
      const woNoParts = { ...VALID_WO, totalPartsCost: 0, parts: [] };
      mockedService.removeWorkOrderPart.mockResolvedValue(woNoParts as never);

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/work-orders/${WO_ID}/parts/${PART_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.totalPartsCost).toBe(0);
      expect(mockedService.removeWorkOrderPart).toHaveBeenCalledWith(
        expect.any(Object),
        WO_ID,
        PART_ID,
      );
    });
  });

  // ─── PATCH /api/org/:orgId/work-orders/:id/close ────────────────────────

  describe('PATCH /api/org/:orgId/work-orders/:id/close', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns 400 when accountingTreatment is absent', async () => {
      const { WorkOrderError } = jest.requireActual('./work-orders.types');
      mockedService.closeWorkOrder.mockRejectedValue(
        new WorkOrderError('Classificacao contabil obrigatoria', 400),
      );

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ closedBy: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/contabil/i);
    });

    it('closes OS with DESPESA treatment and resets asset to ATIVO', async () => {
      mockedService.closeWorkOrder.mockResolvedValue(CLOSED_WO_DESPESA as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingTreatment: 'DESPESA', closedBy: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ENCERRADA');
      expect(res.body.accountingTreatment).toBe('DESPESA');
    });

    it('closes OS with CAPITALIZACAO and increases asset acquisitionValue', async () => {
      const closedCapitalizacao = {
        ...CLOSED_WO_DESPESA,
        accountingTreatment: 'CAPITALIZACAO',
      };
      mockedService.closeWorkOrder.mockResolvedValue(closedCapitalizacao as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingTreatment: 'CAPITALIZACAO', closedBy: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.accountingTreatment).toBe('CAPITALIZACAO');
      expect(mockedService.closeWorkOrder).toHaveBeenCalledWith(
        expect.any(Object),
        WO_ID,
        expect.objectContaining({ accountingTreatment: 'CAPITALIZACAO' }),
      );
    });

    it('closes OS with DIFERIMENTO and creates DeferredMaintenance record', async () => {
      const closedDiferimento = {
        ...CLOSED_WO_DESPESA,
        accountingTreatment: 'DIFERIMENTO',
      };
      mockedService.closeWorkOrder.mockResolvedValue(closedDiferimento as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingTreatment: 'DIFERIMENTO', deferralMonths: 12, closedBy: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.accountingTreatment).toBe('DIFERIMENTO');
      expect(mockedService.closeWorkOrder).toHaveBeenCalledWith(
        expect.any(Object),
        WO_ID,
        expect.objectContaining({ accountingTreatment: 'DIFERIMENTO', deferralMonths: 12 }),
      );
    });

    it('returns 400 when DIFERIMENTO selected without deferralMonths', async () => {
      const { WorkOrderError } = jest.requireActual('./work-orders.types');
      mockedService.closeWorkOrder.mockRejectedValue(
        new WorkOrderError('Numero de meses obrigatorio para diferimento', 400),
      );

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingTreatment: 'DIFERIMENTO', closedBy: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/meses/i);
    });

    it('deducts parts from stock via createConsumptionOutput', async () => {
      const woWithStockOut = { ...CLOSED_WO_DESPESA, stockOutputId: 'stock-out-1' };
      mockedService.closeWorkOrder.mockResolvedValue(woWithStockOut as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingTreatment: 'DESPESA', closedBy: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.stockOutputId).toBe('stock-out-1');
    });

    it('creates WorkOrderCCItem inheriting asset.costCenterId', async () => {
      mockedService.closeWorkOrder.mockResolvedValue(CLOSED_WO_DESPESA as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingTreatment: 'DESPESA', closedBy: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.ccItems).toHaveLength(1);
      expect(res.body.ccItems[0].costCenterId).toBe(CC_ID);
    });

    it('creates WorkOrderCCItem with manual costCenterId override', async () => {
      const woWithOverrideCC = {
        ...CLOSED_WO_DESPESA,
        costCenterId: 'cc-override',
        ccItems: [
          { id: 'cc-item-1', costCenterId: 'cc-override', farmId: 'farm-1', amount: 350, percentage: 100 },
        ],
      };
      mockedService.closeWorkOrder.mockResolvedValue(woWithOverrideCC as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingTreatment: 'DESPESA', costCenterId: 'cc-override', closedBy: 'admin' });

      expect(res.status).toBe(200);
      expect(mockedService.closeWorkOrder).toHaveBeenCalledWith(
        expect.any(Object),
        WO_ID,
        expect.objectContaining({ costCenterId: 'cc-override' }),
      );
    });

    it('WorkOrderCCItem amount equals totalCost exactly (no cent drift)', async () => {
      mockedService.closeWorkOrder.mockResolvedValue(CLOSED_WO_DESPESA as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingTreatment: 'DESPESA', closedBy: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.ccItems[0].amount).toBe(res.body.totalCost);
    });

    it('recalculates MaintenancePlan nextDue after closing linked PREVENTIVA OS', async () => {
      const woWithPlan = {
        ...CLOSED_WO_DESPESA,
        type: 'PREVENTIVA',
        maintenancePlanId: PLAN_ID,
      };
      mockedService.closeWorkOrder.mockResolvedValue(woWithPlan as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/close`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingTreatment: 'DESPESA', closedBy: 'admin' });

      expect(res.status).toBe(200);
      expect(mockedService.closeWorkOrder).toHaveBeenCalled();
      expect(res.body.maintenancePlanId).toBe(PLAN_ID);
    });
  });

  // ─── PATCH /api/org/:orgId/work-orders/:id/cancel ───────────────────────

  describe('PATCH /api/org/:orgId/work-orders/:id/cancel', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('cancels OS and resets asset status to ATIVO', async () => {
      const cancelledWo = { ...VALID_WO, status: 'CANCELADA' };
      mockedService.cancelWorkOrder.mockResolvedValue(cancelledWo as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/cancel`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELADA');
      expect(mockedService.cancelWorkOrder).toHaveBeenCalledWith(
        expect.any(Object),
        WO_ID,
      );
    });

    it('returns 400 when OS is already closed', async () => {
      const { WorkOrderError } = jest.requireActual('./work-orders.types');
      mockedService.cancelWorkOrder.mockRejectedValue(
        new WorkOrderError('OS encerrada nao pode ser cancelada', 400),
      );

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/work-orders/${WO_ID}/cancel`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });
  });

  // ─── GET /api/org/:orgId/work-orders/dashboard ───────────────────────────

  describe('GET /api/org/:orgId/work-orders/dashboard', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns availability, MTBF, MTTR, cost YTD, open count', async () => {
      mockedService.getMaintenanceDashboard.mockResolvedValue(VALID_DASHBOARD as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders/dashboard`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.availability).toBeDefined();
      expect(res.body.mtbfHours).toBeDefined();
      expect(res.body.mttrHours).toBeDefined();
      expect(res.body.totalCostYTD).toBeDefined();
      expect(res.body.openOrdersCount).toBeDefined();
      expect(res.body.overdueMaintenancesCount).toBeDefined();
      expect(res.body.byStatus).toBeDefined();
      expect(res.body.costByAsset).toBeDefined();
    });

    it('returns null for MTBF/MTTR when no corrective OS exist', async () => {
      const dashboardNoMetrics = {
        ...VALID_DASHBOARD,
        mtbfHours: null,
        mttrHours: null,
      };
      mockedService.getMaintenanceDashboard.mockResolvedValue(dashboardNoMetrics as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders/dashboard`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.mtbfHours).toBeNull();
      expect(res.body.mttrHours).toBeNull();
    });

    it('returns byStatus counts', async () => {
      mockedService.getMaintenanceDashboard.mockResolvedValue(VALID_DASHBOARD as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders/dashboard`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(typeof res.body.byStatus).toBe('object');
      expect(res.body.byStatus).not.toBeNull();
    });

    it('returns costByAsset top N', async () => {
      mockedService.getMaintenanceDashboard.mockResolvedValue(VALID_DASHBOARD as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/work-orders/dashboard`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.costByAsset)).toBe(true);
    });
  });
});
