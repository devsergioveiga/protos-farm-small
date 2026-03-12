import request from 'supertest';
import { app } from '../../app';
import * as stockOutputsService from './stock-outputs.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { StockOutputError, type StockOutputTypeValue } from './stock-outputs.types';

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

jest.mock('./stock-outputs.service', () => ({
  createStockOutput: jest.fn(),
  listStockOutputs: jest.fn(),
  getStockOutput: jest.fn(),
  cancelStockOutput: jest.fn(),
  listMovementHistory: jest.fn(),
  exportMovementsCSV: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(stockOutputsService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
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

const OUTPUT_ITEM = {
  id: 'oitem-1',
  productId: 'prod-1',
  productName: 'Roundup Original',
  quantity: 10,
  unitCost: 51,
  totalCost: 510,
  batchNumber: 'LOT-001',
};

const STOCK_OUTPUT_CONSUMPTION = {
  id: 'output-1',
  outputDate: '2026-03-12T00:00:00.000Z',
  type: 'CONSUMPTION' as const,
  typeLabel: 'Consumo (operação)',
  status: 'CONFIRMED' as const,
  fieldOperationRef: 'op-123',
  fieldPlotId: 'plot-1',
  sourceFarmId: 'farm-1',
  sourceFarmName: 'Fazenda São João',
  sourceLocation: 'Galpão 1',
  destinationFarmId: null,
  destinationFarmName: null,
  destinationLocation: null,
  disposalReason: null,
  disposalReasonLabel: null,
  disposalJustification: null,
  authorizedBy: null,
  responsibleName: 'João Silva',
  notes: null,
  totalCost: 510,
  items: [OUTPUT_ITEM],
  createdAt: '2026-03-12T00:00:00.000Z',
  updatedAt: '2026-03-12T00:00:00.000Z',
};

const STOCK_OUTPUT_MANUAL = {
  ...STOCK_OUTPUT_CONSUMPTION,
  id: 'output-2',
  type: 'MANUAL_CONSUMPTION' as const,
  typeLabel: 'Consumo manual',
  fieldOperationRef: null,
};

const STOCK_OUTPUT_TRANSFER = {
  ...STOCK_OUTPUT_CONSUMPTION,
  id: 'output-3',
  type: 'TRANSFER' as const,
  typeLabel: 'Transferência',
  fieldOperationRef: null,
  fieldPlotId: null,
  sourceFarmId: 'farm-1',
  sourceFarmName: 'Fazenda São João',
  sourceLocation: 'Galpão 1',
  destinationFarmId: 'farm-2',
  destinationFarmName: 'Fazenda Boa Vista',
  destinationLocation: 'Galpão 2',
};

const STOCK_OUTPUT_DISPOSAL = {
  ...STOCK_OUTPUT_CONSUMPTION,
  id: 'output-4',
  type: 'DISPOSAL' as const,
  typeLabel: 'Descarte',
  fieldOperationRef: null,
  fieldPlotId: null,
  disposalReason: 'EXPIRED' as const,
  disposalReasonLabel: 'Vencido',
  disposalJustification: 'Produto vencido em 01/2026',
  authorizedBy: 'Carlos Gerente',
};

const MOVEMENT_ENTRY = {
  id: 'mov-1',
  date: '2026-03-10T00:00:00.000Z',
  movementType: 'ENTRY' as const,
  type: 'PURCHASE',
  typeLabel: 'Compra',
  quantity: 100,
  unitCost: 51,
  totalCost: 5100,
  batchNumber: 'LOT-001',
  referenceId: 'entry-1',
  responsibleName: 'Fornecedor A',
  notes: null,
};

const MOVEMENT_EXIT = {
  id: 'mov-2',
  date: '2026-03-12T00:00:00.000Z',
  movementType: 'EXIT' as const,
  type: 'CONSUMPTION',
  typeLabel: 'Consumo (operação)',
  quantity: 10,
  unitCost: 51,
  totalCost: 510,
  batchNumber: 'LOT-001',
  referenceId: 'output-1',
  responsibleName: 'João Silva',
  notes: null,
};

// ─── Tests ──────────────────────────────────────────────────────────

describe('Stock Outputs Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── POST /org/stock-outputs (CA1, CA2, CA3, CA4, CA5, CA6, CA8) ──

  describe('POST /api/org/stock-outputs', () => {
    // ── CA1: Saída por consumo (CONSUMPTION) ──────────────────────

    describe('CA1 — CONSUMPTION type', () => {
      const consumptionBody = {
        type: 'CONSUMPTION',
        items: [{ productId: 'prod-1', quantity: 10 }],
        fieldOperationRef: 'op-123',
        fieldPlotId: 'plot-1',
        sourceFarmId: 'farm-1',
        sourceLocation: 'Galpão 1',
        responsibleName: 'João Silva',
      };

      it('should create a CONSUMPTION output (201)', async () => {
        mockedService.createStockOutput.mockResolvedValue({
          output: STOCK_OUTPUT_CONSUMPTION,
          insufficientStockAlerts: [],
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send(consumptionBody);

        expect(res.status).toBe(201);
        expect(res.body.output.id).toBe('output-1');
        expect(res.body.output.type).toBe('CONSUMPTION');
        expect(res.body.output.typeLabel).toBe('Consumo (operação)');
        expect(res.body.output.status).toBe('CONFIRMED');
        expect(res.body.output.fieldOperationRef).toBe('op-123');
        expect(res.body.output.items).toHaveLength(1);
        expect(res.body.insufficientStockAlerts).toEqual([]);
      });

      it('should audit CREATE_STOCK_OUTPUT on creation', async () => {
        mockedService.createStockOutput.mockResolvedValue({
          output: STOCK_OUTPUT_CONSUMPTION,
          insufficientStockAlerts: [],
        });

        await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send(consumptionBody);

        expect(mockedAudit.logAudit).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'CREATE_STOCK_OUTPUT',
            targetType: 'stock_output',
            targetId: 'output-1',
            metadata: expect.objectContaining({
              type: 'CONSUMPTION',
              itemCount: 1,
              totalCost: 510,
            }),
          }),
        );
      });
    });

    // ── CA2: Saída manual (MANUAL_CONSUMPTION) ────────────────────

    describe('CA2 — MANUAL_CONSUMPTION type', () => {
      const manualBody = {
        type: 'MANUAL_CONSUMPTION',
        items: [{ productId: 'prod-1', quantity: 10 }],
        responsibleName: 'João Silva',
        notes: 'Uso em manutenção do barracão',
      };

      it('should create a MANUAL_CONSUMPTION output (201)', async () => {
        mockedService.createStockOutput.mockResolvedValue({
          output: STOCK_OUTPUT_MANUAL,
          insufficientStockAlerts: [],
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send(manualBody);

        expect(res.status).toBe(201);
        expect(res.body.output.type).toBe('MANUAL_CONSUMPTION');
        expect(res.body.output.typeLabel).toBe('Consumo manual');
      });
    });

    // ── CA3: Transferência (TRANSFER) ─────────────────────────────

    describe('CA3 — TRANSFER type', () => {
      const transferBody = {
        type: 'TRANSFER',
        items: [{ productId: 'prod-1', quantity: 10 }],
        sourceFarmId: 'farm-1',
        sourceLocation: 'Galpão 1',
        destinationFarmId: 'farm-2',
        destinationLocation: 'Galpão 2',
        responsibleName: 'João Silva',
      };

      it('should create a TRANSFER output (201)', async () => {
        mockedService.createStockOutput.mockResolvedValue({
          output: STOCK_OUTPUT_TRANSFER,
          insufficientStockAlerts: [],
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send(transferBody);

        expect(res.status).toBe(201);
        expect(res.body.output.type).toBe('TRANSFER');
        expect(res.body.output.sourceFarmId).toBe('farm-1');
        expect(res.body.output.destinationFarmId).toBe('farm-2');
        expect(res.body.output.destinationFarmName).toBe('Fazenda Boa Vista');
      });

      it('should reject TRANSFER without source (400)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError('Origem é obrigatória para transferência', 400),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'TRANSFER',
            items: [{ productId: 'prod-1', quantity: 10 }],
            destinationFarmId: 'farm-2',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Origem');
      });

      it('should reject TRANSFER without destination (400)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError('Destino é obrigatório para transferência', 400),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'TRANSFER',
            items: [{ productId: 'prod-1', quantity: 10 }],
            sourceFarmId: 'farm-1',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Destino');
      });
    });

    // ── CA4: Descarte (DISPOSAL) ──────────────────────────────────

    describe('CA4 — DISPOSAL type', () => {
      const disposalBody = {
        type: 'DISPOSAL',
        items: [{ productId: 'prod-1', quantity: 5 }],
        disposalReason: 'EXPIRED',
        disposalJustification: 'Produto vencido em 01/2026',
        authorizedBy: 'Carlos Gerente',
        responsibleName: 'João Silva',
      };

      it('should create a DISPOSAL output (201)', async () => {
        mockedService.createStockOutput.mockResolvedValue({
          output: STOCK_OUTPUT_DISPOSAL,
          insufficientStockAlerts: [],
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send(disposalBody);

        expect(res.status).toBe(201);
        expect(res.body.output.type).toBe('DISPOSAL');
        expect(res.body.output.disposalReason).toBe('EXPIRED');
        expect(res.body.output.disposalReasonLabel).toBe('Vencido');
        expect(res.body.output.authorizedBy).toBe('Carlos Gerente');
      });

      it('should reject DISPOSAL without reason (400)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError('Motivo do descarte é obrigatório', 400),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'DISPOSAL',
            items: [{ productId: 'prod-1', quantity: 5 }],
            authorizedBy: 'Carlos',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Motivo');
      });

      it('should reject DISPOSAL with invalid reason (400)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError('Motivo inválido. Use: EXPIRED, DAMAGED, CONTAMINATED, OTHER', 400),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'DISPOSAL',
            items: [{ productId: 'prod-1', quantity: 5 }],
            disposalReason: 'INVALID_REASON',
            authorizedBy: 'Carlos',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Motivo inválido');
      });

      it('should reject DISPOSAL without authorization (400)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError('Autorização é obrigatória para descarte', 400),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'DISPOSAL',
            items: [{ productId: 'prod-1', quantity: 5 }],
            disposalReason: 'DAMAGED',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Autorização');
      });

      it.each(['EXPIRED', 'DAMAGED', 'CONTAMINATED', 'OTHER'] as const)(
        'should accept disposal reason %s',
        async (reason) => {
          const output = {
            ...STOCK_OUTPUT_DISPOSAL,
            disposalReason: reason,
          };
          mockedService.createStockOutput.mockResolvedValue({
            output,
            insufficientStockAlerts: [],
          });

          const res = await request(app)
            .post('/api/org/stock-outputs')
            .set('Authorization', 'Bearer token')
            .send({
              ...disposalBody,
              disposalReason: reason,
            });

          expect(res.status).toBe(201);
        },
      );
    });

    // ── CA5: FEFO batch assignment ────────────────────────────────

    describe('CA5 — FEFO batch assignment', () => {
      it('should assign batch via FEFO (first expiring first)', async () => {
        const outputWithBatch = {
          ...STOCK_OUTPUT_CONSUMPTION,
          items: [{ ...OUTPUT_ITEM, batchNumber: 'LOT-EARLIEST' }],
        };
        mockedService.createStockOutput.mockResolvedValue({
          output: outputWithBatch,
          insufficientStockAlerts: [],
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'CONSUMPTION',
            items: [{ productId: 'prod-1', quantity: 10 }],
          });

        expect(res.status).toBe(201);
        expect(res.body.output.items[0].batchNumber).toBe('LOT-EARLIEST');
      });

      it('should respect explicit batch number when provided', async () => {
        const outputWithExplicit = {
          ...STOCK_OUTPUT_CONSUMPTION,
          items: [{ ...OUTPUT_ITEM, batchNumber: 'LOT-EXPLICIT' }],
        };
        mockedService.createStockOutput.mockResolvedValue({
          output: outputWithExplicit,
          insufficientStockAlerts: [],
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'CONSUMPTION',
            items: [{ productId: 'prod-1', quantity: 10, batchNumber: 'LOT-EXPLICIT' }],
          });

        expect(res.status).toBe(201);
        expect(res.body.output.items[0].batchNumber).toBe('LOT-EXPLICIT');
      });

      it('should handle items without batches (null batch)', async () => {
        const outputNoBatch = {
          ...STOCK_OUTPUT_CONSUMPTION,
          items: [{ ...OUTPUT_ITEM, batchNumber: null }],
        };
        mockedService.createStockOutput.mockResolvedValue({
          output: outputNoBatch,
          insufficientStockAlerts: [],
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'CONSUMPTION',
            items: [{ productId: 'prod-1', quantity: 10 }],
          });

        expect(res.status).toBe(201);
        expect(res.body.output.items[0].batchNumber).toBeNull();
      });
    });

    // ── CA6: Saldo insuficiente ───────────────────────────────────

    describe('CA6 — Insufficient stock', () => {
      it('should reject output when stock is insufficient (422)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError(
            'Saldo insuficiente para: Roundup Original (disponível: 5, solicitado: 100)',
            422,
          ),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'CONSUMPTION',
            items: [{ productId: 'prod-1', quantity: 100 }],
          });

        expect(res.status).toBe(422);
        expect(res.body.error).toContain('Saldo insuficiente');
      });

      it('should allow output with forceInsufficientStock flag', async () => {
        const alerts = [
          {
            productId: 'prod-1',
            productName: 'Roundup Original',
            requested: 100,
            available: 5,
          },
        ];
        mockedService.createStockOutput.mockResolvedValue({
          output: { ...STOCK_OUTPUT_CONSUMPTION, items: [{ ...OUTPUT_ITEM, quantity: 100 }] },
          insufficientStockAlerts: alerts,
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'CONSUMPTION',
            items: [{ productId: 'prod-1', quantity: 100 }],
            forceInsufficientStock: true,
            insufficientStockJustification: 'Ajuste de inventário pendente',
          });

        expect(res.status).toBe(201);
        expect(res.body.insufficientStockAlerts).toHaveLength(1);
        expect(res.body.insufficientStockAlerts[0].available).toBe(5);
        expect(res.body.insufficientStockAlerts[0].requested).toBe(100);
      });
    });

    // ── CA8: Validações gerais do formulário ──────────────────────

    describe('CA8 — Validations', () => {
      it('should reject empty items (400)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError('Pelo menos um item é obrigatório', 400),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({ type: 'CONSUMPTION', items: [] });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('item');
      });

      it('should reject quantity <= 0 (400)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError('Quantidade deve ser maior que zero', 400),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'CONSUMPTION',
            items: [{ productId: 'prod-1', quantity: 0 }],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Quantidade');
      });

      it('should reject missing productId in item (400)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError('Produto é obrigatório em cada item', 400),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'CONSUMPTION',
            items: [{ quantity: 10 }],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Produto');
      });

      it('should reject invalid output type (400)', async () => {
        mockedService.createStockOutput.mockRejectedValue(
          new StockOutputError(
            'Tipo inválido. Use: CONSUMPTION, MANUAL_CONSUMPTION, TRANSFER, DISPOSAL',
            400,
          ),
        );

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'INVALID_TYPE',
            items: [{ productId: 'prod-1', quantity: 10 }],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Tipo inválido');
      });

      it('should handle multiple items', async () => {
        const multiItemOutput = {
          ...STOCK_OUTPUT_CONSUMPTION,
          items: [
            { ...OUTPUT_ITEM, id: 'oitem-1', productId: 'prod-1' },
            {
              ...OUTPUT_ITEM,
              id: 'oitem-2',
              productId: 'prod-2',
              productName: 'Adubo NPK',
              quantity: 20,
              totalCost: 400,
            },
          ],
          totalCost: 910,
        };
        mockedService.createStockOutput.mockResolvedValue({
          output: multiItemOutput,
          insufficientStockAlerts: [],
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({
            type: 'CONSUMPTION',
            items: [
              { productId: 'prod-1', quantity: 10 },
              { productId: 'prod-2', quantity: 20 },
            ],
          });

        expect(res.status).toBe(201);
        expect(res.body.output.items).toHaveLength(2);
        expect(res.body.output.totalCost).toBe(910);
      });
    });

    // ── Auth/Permission tests ─────────────────────────────────────

    describe('Auth & Permission', () => {
      it('should return 401 without auth', async () => {
        mockedAuth.verifyAccessToken.mockImplementation(() => {
          throw new Error('Token inválido');
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .send({ type: 'CONSUMPTION', items: [{ productId: 'prod-1', quantity: 10 }] });

        expect(res.status).toBe(401);
      });

      it('should return 403 for CONSULTANT role', async () => {
        authAs(VIEWER_PAYLOAD);

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({ type: 'CONSUMPTION', items: [{ productId: 'prod-1', quantity: 10 }] });

        expect(res.status).toBe(403);
      });

      it('should allow MANAGER role to create output', async () => {
        authAs(MANAGER_PAYLOAD);
        mockedService.createStockOutput.mockResolvedValue({
          output: STOCK_OUTPUT_CONSUMPTION,
          insufficientStockAlerts: [],
        });

        const res = await request(app)
          .post('/api/org/stock-outputs')
          .set('Authorization', 'Bearer token')
          .send({ type: 'CONSUMPTION', items: [{ productId: 'prod-1', quantity: 10 }] });

        expect(res.status).toBe(201);
      });
    });

    // ── Output type iteration ─────────────────────────────────────

    describe('All output types', () => {
      it.each<StockOutputTypeValue>(['CONSUMPTION', 'MANUAL_CONSUMPTION', 'TRANSFER', 'DISPOSAL'])(
        'should accept output type %s',
        async (type) => {
          const output = { ...STOCK_OUTPUT_CONSUMPTION, type, typeLabel: type };
          mockedService.createStockOutput.mockResolvedValue({
            output,
            insufficientStockAlerts: [],
          });

          const body: Record<string, unknown> = {
            type,
            items: [{ productId: 'prod-1', quantity: 10 }],
          };

          if (type === 'TRANSFER') {
            body.sourceFarmId = 'farm-1';
            body.destinationFarmId = 'farm-2';
          }
          if (type === 'DISPOSAL') {
            body.disposalReason = 'EXPIRED';
            body.authorizedBy = 'Carlos';
          }

          const res = await request(app)
            .post('/api/org/stock-outputs')
            .set('Authorization', 'Bearer token')
            .send(body);

          expect(res.status).toBe(201);
        },
      );
    });
  });

  // ─── GET /org/stock-outputs (CA10) ────────────────────────────────

  describe('GET /api/org/stock-outputs', () => {
    it('should list outputs with pagination', async () => {
      mockedService.listStockOutputs.mockResolvedValue({
        data: [STOCK_OUTPUT_CONSUMPTION],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/org/stock-outputs')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
    });

    it('should filter by type', async () => {
      mockedService.listStockOutputs.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-outputs?type=CONSUMPTION')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockOutputs).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ type: 'CONSUMPTION' }),
      );
    });

    it('should filter by status', async () => {
      mockedService.listStockOutputs.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-outputs?status=CONFIRMED')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockOutputs).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ status: 'CONFIRMED' }),
      );
    });

    it('should filter by productId', async () => {
      mockedService.listStockOutputs.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-outputs?productId=prod-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockOutputs).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ productId: 'prod-1' }),
      );
    });

    it('should filter by responsibleName', async () => {
      mockedService.listStockOutputs.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-outputs?responsibleName=João')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockOutputs).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ responsibleName: 'João' }),
      );
    });

    it('should filter by date range', async () => {
      mockedService.listStockOutputs.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-outputs?dateFrom=2026-01-01&dateTo=2026-12-31')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockOutputs).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ dateFrom: '2026-01-01', dateTo: '2026-12-31' }),
      );
    });

    it('should pass pagination params', async () => {
      mockedService.listStockOutputs.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-outputs?page=2&limit=10')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listStockOutputs).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });

    it('should allow CONSULTANT to read outputs', async () => {
      authAs(VIEWER_PAYLOAD);
      mockedService.listStockOutputs.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-outputs')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });
  });

  // ─── GET /org/stock-outputs/:id ───────────────────────────────────

  describe('GET /api/org/stock-outputs/:id', () => {
    it('should return a single output', async () => {
      mockedService.getStockOutput.mockResolvedValue(STOCK_OUTPUT_CONSUMPTION);

      const res = await request(app)
        .get('/api/org/stock-outputs/output-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('output-1');
      expect(res.body.type).toBe('CONSUMPTION');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].productName).toBe('Roundup Original');
    });

    it('should return 404 for missing output', async () => {
      mockedService.getStockOutput.mockRejectedValue(
        new StockOutputError('Saída não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/stock-outputs/not-found')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('não encontrada');
    });

    it('should allow CONSULTANT to read a single output', async () => {
      authAs(VIEWER_PAYLOAD);
      mockedService.getStockOutput.mockResolvedValue(STOCK_OUTPUT_CONSUMPTION);

      const res = await request(app)
        .get('/api/org/stock-outputs/output-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });
  });

  // ─── PATCH /org/stock-outputs/:id/cancel ──────────────────────────

  describe('PATCH /api/org/stock-outputs/:id/cancel', () => {
    it('should cancel output and revert balances', async () => {
      const cancelledOutput = { ...STOCK_OUTPUT_CONSUMPTION, status: 'CANCELLED' as const };
      mockedService.cancelStockOutput.mockResolvedValue(cancelledOutput);

      const res = await request(app)
        .patch('/api/org/stock-outputs/output-1/cancel')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('should audit CANCEL_STOCK_OUTPUT on cancellation', async () => {
      const cancelledOutput = { ...STOCK_OUTPUT_CONSUMPTION, status: 'CANCELLED' as const };
      mockedService.cancelStockOutput.mockResolvedValue(cancelledOutput);

      await request(app)
        .patch('/api/org/stock-outputs/output-1/cancel')
        .set('Authorization', 'Bearer token');

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CANCEL_STOCK_OUTPUT',
          targetType: 'stock_output',
          targetId: 'output-1',
          metadata: expect.objectContaining({ type: 'CONSUMPTION' }),
        }),
      );
    });

    it('should reject cancelling already cancelled output (400)', async () => {
      mockedService.cancelStockOutput.mockRejectedValue(
        new StockOutputError('Saída já está cancelada', 400),
      );

      const res = await request(app)
        .patch('/api/org/stock-outputs/output-1/cancel')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('já está cancelada');
    });

    it('should return 404 for missing output', async () => {
      mockedService.cancelStockOutput.mockRejectedValue(
        new StockOutputError('Saída não encontrada', 404),
      );

      const res = await request(app)
        .patch('/api/org/stock-outputs/not-found/cancel')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });

    it('should return 403 for CONSULTANT role', async () => {
      authAs(VIEWER_PAYLOAD);

      const res = await request(app)
        .patch('/api/org/stock-outputs/output-1/cancel')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /org/stock-movements (CA7) ───────────────────────────────

  describe('GET /api/org/stock-movements', () => {
    it('should return movement history for a product', async () => {
      mockedService.listMovementHistory.mockResolvedValue({
        data: [MOVEMENT_ENTRY, MOVEMENT_EXIT],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/org/stock-movements?productId=prod-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].movementType).toBe('ENTRY');
      expect(res.body.data[1].movementType).toBe('EXIT');
      expect(res.body.total).toBe(2);
    });

    it('should require productId (400)', async () => {
      mockedService.listMovementHistory.mockRejectedValue(
        new StockOutputError('Produto é obrigatório para consultar movimentações', 400),
      );

      const res = await request(app)
        .get('/api/org/stock-movements')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Produto é obrigatório');
    });

    it('should filter by movementType ENTRY', async () => {
      mockedService.listMovementHistory.mockResolvedValue({
        data: [MOVEMENT_ENTRY],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/org/stock-movements?productId=prod-1&movementType=ENTRY')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listMovementHistory).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ productId: 'prod-1', movementType: 'ENTRY' }),
      );
    });

    it('should filter by movementType EXIT', async () => {
      mockedService.listMovementHistory.mockResolvedValue({
        data: [MOVEMENT_EXIT],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/org/stock-movements?productId=prod-1&movementType=EXIT')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listMovementHistory).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ movementType: 'EXIT' }),
      );
    });

    it('should filter by date range', async () => {
      mockedService.listMovementHistory.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-movements?productId=prod-1&dateFrom=2026-03-01&dateTo=2026-03-31')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listMovementHistory).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ dateFrom: '2026-03-01', dateTo: '2026-03-31' }),
      );
    });

    it('should filter by responsibleName', async () => {
      mockedService.listMovementHistory.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-movements?productId=prod-1&responsibleName=João')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listMovementHistory).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ responsibleName: 'João' }),
      );
    });

    it('should pass pagination params', async () => {
      mockedService.listMovementHistory.mockResolvedValue({
        data: [],
        total: 0,
        page: 3,
        limit: 5,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-movements?productId=prod-1&page=3&limit=5')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listMovementHistory).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ page: 3, limit: 5 }),
      );
    });

    it('should allow CONSULTANT to read movements', async () => {
      authAs(VIEWER_PAYLOAD);
      mockedService.listMovementHistory.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/org/stock-movements?productId=prod-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });
  });

  // ─── GET /org/stock-movements/export (CA10) ───────────────────────

  describe('GET /api/org/stock-movements/export', () => {
    const csvContent =
      'Data,Tipo Mov.,Tipo,Quantidade,Custo Unit.,Custo Total,Lote,Responsável,Observações\n' +
      '10/03/2026,Entrada,Compra,100.0000,51.0000,5100.00,LOT-001,Fornecedor A,\n' +
      '12/03/2026,Saída,Consumo (operação),10.0000,51.0000,510.00,LOT-001,João Silva,';

    it('should export movements as CSV', async () => {
      mockedService.exportMovementsCSV.mockResolvedValue(csvContent);

      const res = await request(app)
        .get('/api/org/stock-movements/export?productId=prod-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('movimentacoes-');
      expect(res.headers['content-disposition']).toContain('.csv');
      expect(res.text).toContain('Data,Tipo Mov.');
      expect(res.text).toContain('Entrada');
      expect(res.text).toContain('Saída');
    });

    it('should pass filters to export', async () => {
      mockedService.exportMovementsCSV.mockResolvedValue(csvContent);

      const res = await request(app)
        .get(
          '/api/org/stock-movements/export?productId=prod-1&movementType=EXIT&dateFrom=2026-03-01&dateTo=2026-03-31',
        )
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.exportMovementsCSV).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          productId: 'prod-1',
          movementType: 'EXIT',
          dateFrom: '2026-03-01',
          dateTo: '2026-03-31',
        }),
      );
    });

    it('should filter export by responsibleName', async () => {
      mockedService.exportMovementsCSV.mockResolvedValue(csvContent);

      const res = await request(app)
        .get('/api/org/stock-movements/export?productId=prod-1&responsibleName=João')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.exportMovementsCSV).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ responsibleName: 'João' }),
      );
    });

    it('should require productId for export (400)', async () => {
      mockedService.exportMovementsCSV.mockRejectedValue(
        new StockOutputError('Produto é obrigatório para consultar movimentações', 400),
      );

      const res = await request(app)
        .get('/api/org/stock-movements/export')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
    });

    it('should allow CONSULTANT to export', async () => {
      authAs(VIEWER_PAYLOAD);
      mockedService.exportMovementsCSV.mockResolvedValue(csvContent);

      const res = await request(app)
        .get('/api/org/stock-movements/export?productId=prod-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });
  });

  // ─── Error handling ───────────────────────────────────────────────

  describe('Error handling', () => {
    it('should return 500 for unexpected errors on create', async () => {
      mockedService.createStockOutput.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app)
        .post('/api/org/stock-outputs')
        .set('Authorization', 'Bearer token')
        .send({
          type: 'CONSUMPTION',
          items: [{ productId: 'prod-1', quantity: 10 }],
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });

    it('should return 500 for unexpected errors on list', async () => {
      mockedService.listStockOutputs.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app)
        .get('/api/org/stock-outputs')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });

    it('should return 500 for unexpected errors on cancel', async () => {
      mockedService.cancelStockOutput.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app)
        .patch('/api/org/stock-outputs/output-1/cancel')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });

    it('should return 500 for unexpected errors on movements', async () => {
      mockedService.listMovementHistory.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app)
        .get('/api/org/stock-movements?productId=prod-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });

    it('should return 500 for unexpected errors on export', async () => {
      mockedService.exportMovementsCSV.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app)
        .get('/api/org/stock-movements/export?productId=prod-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });
  });
});
