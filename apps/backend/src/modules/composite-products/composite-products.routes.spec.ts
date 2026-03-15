import request from 'supertest';
import { app } from '../../app';
import * as compositeProductsService from './composite-products.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  CompositeProductError,
  type CompositeProductDetail,
  type ProductionItem,
} from './composite-products.types';

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

jest.mock('./composite-products.service', () => ({
  getCompositeDetail: jest.fn(),
  setCompositeIngredients: jest.fn(),
  recordProduction: jest.fn(),
  listProductions: jest.fn(),
  getProduction: jest.fn(),
  deleteProduction: jest.fn(),
  exportProductionRecipe: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(compositeProductsService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'op-1',
  email: 'op@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const SAMPLE_DETAIL: CompositeProductDetail = {
  productId: 'prod-1',
  productName: 'Calda Bordá',
  compositeType: 'calda',
  compositeTypeLabel: 'Calda de defensivo',
  batchSize: 1000,
  batchUnit: 'L',
  ingredients: [
    {
      id: 'ing-1',
      ingredientProductId: 'prod-2',
      ingredientProductName: 'Sulfato de Cobre',
      ingredientMeasurementUnit: 'kg',
      quantityPerBatch: 10,
      unitCostCents: 1500,
      sortOrder: 0,
      notes: null,
    },
    {
      id: 'ing-2',
      ingredientProductId: 'prod-3',
      ingredientProductName: 'Cal Virgem',
      ingredientMeasurementUnit: 'kg',
      quantityPerBatch: 10,
      unitCostCents: 800,
      sortOrder: 1,
      notes: 'Diluir antes',
    },
  ],
  estimatedCostCents: 23000,
};

const SAMPLE_PRODUCTION: ProductionItem = {
  id: 'cprod-1',
  compositeProductId: 'prod-1',
  productName: 'Calda Bordá',
  productionDate: '2026-03-14',
  batchNumber: 'LOTE-001',
  quantityProduced: 1000,
  totalCostCents: 23000,
  responsibleName: 'João Silva',
  stockEntryId: 'se-1',
  stockOutputId: 'so-1',
  items: [
    {
      ingredientProductId: 'prod-2',
      ingredientProductName: 'Sulfato de Cobre',
      quantityUsed: 10,
      unitCostCents: 1500,
      totalCostCents: 15000,
      sourceBatchNumber: null,
    },
    {
      ingredientProductId: 'prod-3',
      ingredientProductName: 'Cal Virgem',
      quantityUsed: 10,
      unitCostCents: 800,
      totalCostCents: 8000,
      sourceBatchNumber: 'B-123',
    },
  ],
  createdAt: '2026-03-14T10:00:00.000Z',
};

describe('Composite products routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ═══════════════════════════════════════════════════════════════
  // COMPOSITE DETAIL & INGREDIENTS
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/org/products/:productId/composite', () => {
    it('should return composite detail with ingredients and cost', async () => {
      mockedService.getCompositeDetail.mockResolvedValue(SAMPLE_DETAIL);

      const res = await request(app)
        .get('/api/org/products/prod-1/composite')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.productId).toBe('prod-1');
      expect(res.body.compositeType).toBe('calda');
      expect(res.body.compositeTypeLabel).toBe('Calda de defensivo');
      expect(res.body.ingredients).toHaveLength(2);
      expect(res.body.estimatedCostCents).toBe(23000);
    });

    it('should return 404 when product not found', async () => {
      mockedService.getCompositeDetail.mockRejectedValue(
        new CompositeProductError('Produto não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/products/nonexistent/composite')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should return 400 when product is not composite', async () => {
      mockedService.getCompositeDetail.mockRejectedValue(
        new CompositeProductError('Este produto não é um produto composto', 400),
      );

      const res = await request(app)
        .get('/api/org/products/prod-simple/composite')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/org/products/:productId/composite', () => {
    const validInput = {
      isComposite: true,
      compositeType: 'calda',
      batchSize: 1000,
      batchUnit: 'L',
      ingredients: [
        { ingredientProductId: 'prod-2', quantityPerBatch: 10 },
        { ingredientProductId: 'prod-3', quantityPerBatch: 10, notes: 'Diluir antes' },
      ],
    };

    it('should set composite ingredients and return detail', async () => {
      mockedService.setCompositeIngredients.mockResolvedValue(SAMPLE_DETAIL);

      const res = await request(app)
        .put('/api/org/products/prod-1/composite')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(200);
      expect(res.body.productId).toBe('prod-1');
      expect(res.body.ingredients).toHaveLength(2);
      expect(mockedService.setCompositeIngredients).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'prod-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for invalid composite type', async () => {
      mockedService.setCompositeIngredients.mockRejectedValue(
        new CompositeProductError(
          'Tipo inválido. Use: calda, mistura_fertilizante, racao_concentrado, pre_mistura_mineral, outro',
          400,
        ),
      );

      const res = await request(app)
        .put('/api/org/products/prod-1/composite')
        .set('Authorization', 'Bearer tok')
        .send({ ...validInput, compositeType: 'invalido' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for empty ingredients', async () => {
      mockedService.setCompositeIngredients.mockRejectedValue(
        new CompositeProductError('Pelo menos um ingrediente é obrigatório', 400),
      );

      const res = await request(app)
        .put('/api/org/products/prod-1/composite')
        .set('Authorization', 'Bearer tok')
        .send({ ...validInput, ingredients: [] });

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PRODUCTIONS
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/org/composite-productions', () => {
    const validInput = {
      compositeProductId: 'prod-1',
      productionDate: '2026-03-14',
      batchNumber: 'LOTE-001',
      quantityProduced: 1000,
      responsibleName: 'João Silva',
      ingredients: [
        { productId: 'prod-2', quantityUsed: 10 },
        { productId: 'prod-3', quantityUsed: 10, sourceBatchNumber: 'B-123' },
      ],
    };

    it('should record production and return 201', async () => {
      mockedService.recordProduction.mockResolvedValue(SAMPLE_PRODUCTION);

      const res = await request(app)
        .post('/api/org/composite-productions')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('cprod-1');
      expect(res.body.quantityProduced).toBe(1000);
      expect(res.body.totalCostCents).toBe(23000);
      expect(res.body.stockEntryId).toBe('se-1');
      expect(res.body.stockOutputId).toBe('so-1');
      expect(res.body.items).toHaveLength(2);
      expect(mockedService.recordProduction).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      mockedService.recordProduction.mockRejectedValue(
        new CompositeProductError('Produto composto é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/composite-productions')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 when composite product not found', async () => {
      mockedService.recordProduction.mockRejectedValue(
        new CompositeProductError('Produto composto não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/composite-productions')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/org/composite-productions', () => {
    it('should list productions with pagination', async () => {
      mockedService.listProductions.mockResolvedValue({
        data: [SAMPLE_PRODUCTION],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/org/composite-productions')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should pass filters to service', async () => {
      mockedService.listProductions.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get(
          '/api/org/composite-productions?compositeProductId=prod-1&dateFrom=2026-03-01&dateTo=2026-03-31',
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listProductions).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({
          compositeProductId: 'prod-1',
          dateFrom: '2026-03-01',
          dateTo: '2026-03-31',
        }),
      );
    });
  });

  describe('GET /api/org/composite-productions/:productionId', () => {
    it('should return production detail with items', async () => {
      mockedService.getProduction.mockResolvedValue(SAMPLE_PRODUCTION);

      const res = await request(app)
        .get('/api/org/composite-productions/cprod-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('cprod-1');
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].ingredientProductName).toBe('Sulfato de Cobre');
    });

    it('should return 404 when not found', async () => {
      mockedService.getProduction.mockRejectedValue(
        new CompositeProductError('Produção não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/composite-productions/nonexistent')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/org/composite-productions/:productionId', () => {
    it('should delete production and return success', async () => {
      mockedService.deleteProduction.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/composite-productions/cprod-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Produção excluída com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deleteProduction.mockRejectedValue(
        new CompositeProductError('Produção não encontrada', 404),
      );

      const res = await request(app)
        .delete('/api/org/composite-productions/nonexistent')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/org/products/:productId/composite/recipe', () => {
    it('should export recipe as CSV', async () => {
      const csvContent =
        '\uFEFF"Receita de Produção"\n"Produto";"Calda Bordá"\n"Tipo";"Calda de defensivo"\n"Tamanho do Lote";"1000 L"\n\nOrdem;Ingrediente;Quantidade por Lote;Unidade;Observações\n"1";"Sulfato de Cobre";"10";"kg";""\n"2";"Cal Virgem";"10";"kg";"Diluir antes"';
      mockedService.exportProductionRecipe.mockResolvedValue(csvContent);

      const res = await request(app)
        .get('/api/org/products/prod-1/composite/recipe')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('receita-producao.csv');
    });

    it('should return 404 when composite product not found', async () => {
      mockedService.exportProductionRecipe.mockRejectedValue(
        new CompositeProductError('Produto composto não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/products/nonexistent/composite/recipe')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── AUTH / PERMISSIONS ──────────────────────────────────────────

  describe('Permission checks', () => {
    it('should allow OPERATOR to read composite detail (farms:read)', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.getCompositeDetail.mockResolvedValue(SAMPLE_DETAIL);

      const res = await request(app)
        .get('/api/org/products/prod-1/composite')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
    });

    it('should deny OPERATOR from setting composite ingredients (requires farms:update)', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .put('/api/org/products/prod-1/composite')
        .set('Authorization', 'Bearer tok')
        .send({
          isComposite: true,
          compositeType: 'calda',
          batchSize: 1000,
          batchUnit: 'L',
          ingredients: [{ ingredientProductId: 'prod-2', quantityPerBatch: 10 }],
        });

      expect(res.status).toBe(403);
    });

    it('should deny OPERATOR from recording production (requires farms:update)', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/composite-productions')
        .set('Authorization', 'Bearer tok')
        .send({
          compositeProductId: 'prod-1',
          productionDate: '2026-03-14',
          quantityProduced: 100,
          responsibleName: 'João',
          ingredients: [{ productId: 'prod-2', quantityUsed: 10 }],
        });

      expect(res.status).toBe(403);
    });

    it('should deny OPERATOR from deleting production (requires farms:update)', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/composite-productions/cprod-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });

    it('should allow OPERATOR to list productions (farms:read)', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.listProductions.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app)
        .get('/api/org/composite-productions')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
    });

    it('should allow OPERATOR to export recipe (farms:read)', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.exportProductionRecipe.mockResolvedValue('\uFEFFtest');

      const res = await request(app)
        .get('/api/org/products/prod-1/composite/recipe')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
    });

    it('should return 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).get('/api/org/products/prod-1/composite');

      expect(res.status).toBe(401);
    });
  });
});
