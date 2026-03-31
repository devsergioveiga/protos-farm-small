import request from 'supertest';
import { app } from '../../app';
import * as productsService from './products.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { ProductError } from './products.types';

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

jest.mock('./products.service', () => ({
  createProduct: jest.fn(),
  listProducts: jest.fn(),
  getProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  listManufacturers: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(productsService);
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

const NULL_TYPE_FIELDS = {
  toxicityClass: null,
  mapaRegistration: null,
  environmentalClass: null,
  actionMode: null,
  chemicalGroup: null,
  withdrawalPeriods: null,
  npkFormulation: null,
  nutrientForm: null,
  solubility: null,
  nutrientComposition: null,
  nutritionalComposition: null,
  sprayCompatibility: null,
  therapeuticClass: null,
  administrationRoute: null,
  milkWithdrawalHours: null,
  slaughterWithdrawalDays: null,
  vetMapaRegistration: null,
  requiresPrescription: false,
  storageCondition: null,
  cultivarId: null,
  cultivarName: null,
  sieveSize: null,
  industrialTreatment: null,
  germinationPct: null,
  purityPct: null,
  reorderPoint: null,
  safetyStock: null,
  expiryAlertDays: null,
};

const PRODUCT_ITEM = {
  id: 'prod-1',
  organizationId: 'org-1',
  nature: 'PRODUCT',
  name: 'Roundup Original',
  type: 'defensivo_herbicida',
  category: 'Herbicidas',
  status: 'ACTIVE',
  notes: null,
  commercialName: 'Roundup Original DI',
  manufacturer: { id: 'mfr-1', name: 'Bayer', cnpj: '18.459.628/0001-01' },
  measurementUnitId: 'unit-1',
  measurementUnitAbbreviation: 'L',
  barcode: '7891033025640',
  photoUrl: null,
  technicalSheetUrl: null,
  chargeUnit: null,
  unitCost: null,
  typicalFrequency: null,
  requiresScheduling: false,
  linkedActivity: null,
  productClassId: null,
  productClassName: null,
  compositions: [
    {
      id: 'comp-1',
      activeIngredient: 'Glifosato',
      concentration: '480 g/L',
      function: 'herbicida',
    },
  ],
  ...NULL_TYPE_FIELDS,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SERVICE_ITEM = {
  id: 'svc-1',
  organizationId: 'org-1',
  nature: 'SERVICE',
  name: 'Consultoria Agronômica',
  type: 'consultoria_agronomica',
  category: null,
  status: 'ACTIVE',
  notes: null,
  commercialName: null,
  manufacturer: null,
  measurementUnitId: null,
  measurementUnitAbbreviation: null,
  barcode: null,
  photoUrl: null,
  technicalSheetUrl: null,
  chargeUnit: 'visita',
  unitCost: 350.0,
  typicalFrequency: 'mensal',
  requiresScheduling: true,
  linkedActivity: 'todas',
  productClassId: null,
  productClassName: null,
  compositions: [],
  ...NULL_TYPE_FIELDS,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  authAs(ADMIN_PAYLOAD);
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /api/org/products', () => {
  it('cria um produto com composição', async () => {
    mockedService.createProduct.mockResolvedValue(PRODUCT_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'Roundup Original',
        type: 'defensivo_herbicida',
        category: 'Herbicidas',
        commercialName: 'Roundup Original DI',
        manufacturerName: 'Bayer',
        manufacturerCnpj: '18.459.628/0001-01',
        measurementUnitId: 'unit-1',
        barcode: '7891033025640',
        compositions: [
          { activeIngredient: 'Glifosato', concentration: '480 g/L', function: 'herbicida' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Roundup Original');
    expect(res.body.compositions).toHaveLength(1);
    expect(mockedService.createProduct).toHaveBeenCalledTimes(1);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_PRODUCT' }),
    );
  });

  it('cria um serviço', async () => {
    mockedService.createProduct.mockResolvedValue(SERVICE_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'SERVICE',
        name: 'Consultoria Agronômica',
        type: 'consultoria_agronomica',
        chargeUnit: 'visita',
        unitCost: 350,
        typicalFrequency: 'mensal',
        requiresScheduling: true,
        linkedActivity: 'todas',
      });

    expect(res.status).toBe(201);
    expect(res.body.nature).toBe('SERVICE');
    expect(res.body.chargeUnit).toBe('visita');
    expect(res.body.unitCost).toBe(350);
  });

  it('retorna 400 para natureza inválida', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Natureza inválida. Use: PRODUCT, SERVICE', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({ nature: 'INVALID', name: 'X', type: 'outro' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Natureza inválida');
  });

  it('retorna 400 para tipo inválido', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Tipo inválido para PRODUCT', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({ nature: 'PRODUCT', name: 'X', type: 'invalid_type' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Tipo inválido');
  });

  it('retorna 409 para nome duplicado', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Já existe um cadastro com este nome e natureza', 409),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({ nature: 'PRODUCT', name: 'Roundup Original', type: 'defensivo_herbicida' });

    expect(res.status).toBe(409);
  });

  it('retorna 403 para CONSULTANT', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({ nature: 'PRODUCT', name: 'X', type: 'outro' });

    expect(res.status).toBe(403);
  });

  it('retorna 401 sem token', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Token inválido');
    });

    const res = await request(app).post('/api/org/products').send({});
    expect(res.status).toBe(401);
  });
});

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /api/org/products', () => {
  it('lista produtos paginados', async () => {
    mockedService.listProducts.mockResolvedValue({
      data: [PRODUCT_ITEM],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const res = await request(app).get('/api/org/products').set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('filtra por natureza', async () => {
    mockedService.listProducts.mockResolvedValue({
      data: [SERVICE_ITEM],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const res = await request(app)
      .get('/api/org/products?nature=SERVICE')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listProducts).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ nature: 'SERVICE' }),
    );
  });

  it('filtra por busca textual', async () => {
    mockedService.listProducts.mockResolvedValue({
      data: [PRODUCT_ITEM],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const res = await request(app)
      .get('/api/org/products?search=Roundup')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listProducts).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ search: 'Roundup' }),
    );
  });

  it('filtra por tipo', async () => {
    mockedService.listProducts.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const res = await request(app)
      .get('/api/org/products?type=semente')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listProducts).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ type: 'semente' }),
    );
  });

  it('filtra por status', async () => {
    mockedService.listProducts.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const res = await request(app)
      .get('/api/org/products?status=INACTIVE')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listProducts).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ status: 'INACTIVE' }),
    );
  });

  it('aceita paginação', async () => {
    mockedService.listProducts.mockResolvedValue({
      data: [],
      total: 50,
      page: 3,
      limit: 10,
      totalPages: 5,
    });

    const res = await request(app)
      .get('/api/org/products?page=3&limit=10')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(res.body.totalPages).toBe(5);
  });

  it('CONSULTANT pode listar', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listProducts.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const res = await request(app).get('/api/org/products').set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
  });
});

// ─── GET ────────────────────────────────────────────────────────────

describe('GET /api/org/products/:id', () => {
  it('retorna produto por id', async () => {
    mockedService.getProduct.mockResolvedValue(PRODUCT_ITEM);

    const res = await request(app)
      .get('/api/org/products/prod-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('prod-1');
    expect(res.body.compositions).toHaveLength(1);
  });

  it('retorna 404 para produto inexistente', async () => {
    mockedService.getProduct.mockRejectedValue(
      new ProductError('Produto/serviço não encontrado', 404),
    );

    const res = await request(app)
      .get('/api/org/products/inexistente')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PUT /api/org/products/:id', () => {
  it('atualiza nome do produto', async () => {
    const updated = { ...PRODUCT_ITEM, name: 'Roundup WG' };
    mockedService.updateProduct.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/org/products/prod-1')
      .set('Authorization', 'Bearer tok')
      .send({ name: 'Roundup WG' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Roundup WG');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_PRODUCT' }),
    );
  });

  it('atualiza composição', async () => {
    const updated = {
      ...PRODUCT_ITEM,
      compositions: [
        {
          id: 'comp-2',
          activeIngredient: 'Glifosato',
          concentration: '720 g/kg',
          function: 'herbicida',
        },
      ],
    };
    mockedService.updateProduct.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/org/products/prod-1')
      .set('Authorization', 'Bearer tok')
      .send({
        compositions: [
          { activeIngredient: 'Glifosato', concentration: '720 g/kg', function: 'herbicida' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.compositions[0].concentration).toBe('720 g/kg');
  });

  it('atualiza campos de serviço', async () => {
    const updated = { ...SERVICE_ITEM, unitCost: 400 };
    mockedService.updateProduct.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/org/products/svc-1')
      .set('Authorization', 'Bearer tok')
      .send({ unitCost: 400 });

    expect(res.status).toBe(200);
    expect(res.body.unitCost).toBe(400);
  });

  it('retorna 404 para produto inexistente', async () => {
    mockedService.updateProduct.mockRejectedValue(
      new ProductError('Produto/serviço não encontrado', 404),
    );

    const res = await request(app)
      .put('/api/org/products/inexistente')
      .set('Authorization', 'Bearer tok')
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('retorna 403 para CONSULTANT', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .put('/api/org/products/prod-1')
      .set('Authorization', 'Bearer tok')
      .send({ name: 'X' });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/org/products/:id', () => {
  it('soft delete produto', async () => {
    mockedService.deleteProduct.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/products/prod-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_PRODUCT' }),
    );
  });

  it('retorna 404 para produto inexistente', async () => {
    mockedService.deleteProduct.mockRejectedValue(
      new ProductError('Produto/serviço não encontrado', 404),
    );

    const res = await request(app)
      .delete('/api/org/products/inexistente')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });

  it('retorna 403 para CONSULTANT', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .delete('/api/org/products/prod-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(403);
  });
});

// ─── MANUFACTURERS ──────────────────────────────────────────────────

describe('GET /api/org/manufacturers', () => {
  it('lista fabricantes', async () => {
    mockedService.listManufacturers.mockResolvedValue([
      { id: 'mfr-1', name: 'Bayer', cnpj: '18.459.628/0001-01' },
      { id: 'mfr-2', name: 'Syngenta', cnpj: null },
    ]);

    const res = await request(app).get('/api/org/manufacturers').set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Bayer');
  });

  it('filtra fabricantes por busca', async () => {
    mockedService.listManufacturers.mockResolvedValue([
      { id: 'mfr-1', name: 'Bayer', cnpj: '18.459.628/0001-01' },
    ]);

    const res = await request(app)
      .get('/api/org/manufacturers?search=Bay')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listManufacturers).toHaveBeenCalledWith(expect.any(Object), 'Bay');
  });

  it('CONSULTANT pode listar fabricantes', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listManufacturers.mockResolvedValue([]);

    const res = await request(app).get('/api/org/manufacturers').set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
  });
});

// ─── Validações de negócio (CA1-CA7) ────────────────────────────────

describe('Validações CA1-CA7', () => {
  it('CA1: aceita natureza PRODUCT', async () => {
    mockedService.createProduct.mockResolvedValue(PRODUCT_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({ nature: 'PRODUCT', name: 'Semente Milho', type: 'semente' });

    expect(res.status).toBe(201);
  });

  it('CA1: aceita natureza SERVICE', async () => {
    mockedService.createProduct.mockResolvedValue(SERVICE_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({ nature: 'SERVICE', name: 'Frete', type: 'frete_insumos' });

    expect(res.status).toBe(201);
  });

  it('CA2: aceita todos os tipos de produto', async () => {
    const types = [
      'semente',
      'fertilizante',
      'defensivo_herbicida',
      'defensivo_inseticida',
      'defensivo_fungicida',
      'defensivo_acaricida',
      'adjuvante',
      'corretivo_calcario',
      'corretivo_gesso',
      'inoculante',
      'biologico',
      'medicamento_veterinario',
      'hormonio_reprodutivo',
      'suplemento_mineral_vitaminico',
      'semen',
      'combustivel',
      'peca_componente',
      'epi',
      'material_consumo',
      'outro',
    ];

    for (const type of types) {
      mockedService.createProduct.mockResolvedValue({ ...PRODUCT_ITEM, type });
      const res = await request(app)
        .post('/api/org/products')
        .set('Authorization', 'Bearer tok')
        .send({ nature: 'PRODUCT', name: `Prod ${type}`, type });
      expect(res.status).toBe(201);
    }
    expect(mockedService.createProduct).toHaveBeenCalledTimes(types.length);
  });

  it('CA3: aceita todos os tipos de serviço', async () => {
    const types = [
      'consultoria_agronomica',
      'consultoria_veterinaria',
      'inseminacao_artificial',
      'analise_laboratorial',
      'transporte_leite',
      'frete_insumos',
      'manutencao_equipamento',
      'topografia_georreferenciamento',
      'assessoria_contabil_fiscal',
      'servico_maquinas_terceirizado',
      'certificacao_auditoria',
      'outro',
    ];

    for (const type of types) {
      mockedService.createProduct.mockResolvedValue({ ...SERVICE_ITEM, type });
      const res = await request(app)
        .post('/api/org/products')
        .set('Authorization', 'Bearer tok')
        .send({ nature: 'SERVICE', name: `Svc ${type}`, type });
      expect(res.status).toBe(201);
    }
    expect(mockedService.createProduct).toHaveBeenCalledTimes(types.length);
  });

  it('CA4: envia campos gerais (nome, natureza, tipo, categoria, status, observações)', async () => {
    mockedService.createProduct.mockResolvedValue({
      ...PRODUCT_ITEM,
      category: 'Herbicidas Pós',
      status: 'ACTIVE',
      notes: 'Uso em dessecação pré-plantio',
    });

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'Roundup',
        type: 'defensivo_herbicida',
        category: 'Herbicidas Pós',
        status: 'ACTIVE',
        notes: 'Uso em dessecação pré-plantio',
      });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('Herbicidas Pós');
    expect(res.body.notes).toBe('Uso em dessecação pré-plantio');
  });

  it('CA5: envia campos de produto (commercialName, fabricante, unidade, barcode)', async () => {
    mockedService.createProduct.mockResolvedValue(PRODUCT_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'Roundup Original',
        type: 'defensivo_herbicida',
        commercialName: 'Roundup Original DI',
        manufacturerName: 'Bayer',
        manufacturerCnpj: '18.459.628/0001-01',
        measurementUnitId: 'unit-1',
        barcode: '7891033025640',
      });

    expect(res.status).toBe(201);
    expect(res.body.commercialName).toBe('Roundup Original DI');
    expect(res.body.manufacturer.name).toBe('Bayer');
    expect(res.body.barcode).toBe('7891033025640');
  });

  it('CA6: envia campos de serviço (chargeUnit, unitCost, frequency, scheduling, activity)', async () => {
    mockedService.createProduct.mockResolvedValue(SERVICE_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'SERVICE',
        name: 'Consultoria',
        type: 'consultoria_agronomica',
        chargeUnit: 'visita',
        unitCost: 350,
        typicalFrequency: 'mensal',
        requiresScheduling: true,
        linkedActivity: 'todas',
      });

    expect(res.status).toBe(201);
    expect(res.body.chargeUnit).toBe('visita');
    expect(res.body.requiresScheduling).toBe(true);
  });

  it('CA7: envia composição com múltiplas substâncias', async () => {
    const multiComp = {
      ...PRODUCT_ITEM,
      compositions: [
        {
          id: 'c1',
          activeIngredient: 'Cipermetrina',
          concentration: '250 g/L',
          function: 'inseticida',
        },
        {
          id: 'c2',
          activeIngredient: 'Tiametoxam',
          concentration: '141 g/L',
          function: 'inseticida',
        },
      ],
    };
    mockedService.createProduct.mockResolvedValue(multiComp);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'Engeo Pleno',
        type: 'defensivo_inseticida',
        compositions: [
          { activeIngredient: 'Cipermetrina', concentration: '250 g/L', function: 'inseticida' },
          { activeIngredient: 'Tiametoxam', concentration: '141 g/L', function: 'inseticida' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.compositions).toHaveLength(2);
  });
});

// ─── Validações CA8-CA12 (campos específicos por tipo) ──────────────

describe('CA8: Defensivos', () => {
  const DEFENSIVO_ITEM = {
    ...PRODUCT_ITEM,
    type: 'defensivo_herbicida',
    toxicityClass: 'IV',
    mapaRegistration: '12345',
    environmentalClass: 'III',
    actionMode: 'sistêmico',
    chemicalGroup: 'glicina substituída',
    withdrawalPeriods: [
      { crop: 'soja', days: 56 },
      { crop: 'milho', days: 30 },
    ],
  };

  it('cria defensivo com campos CA8', async () => {
    mockedService.createProduct.mockResolvedValue(DEFENSIVO_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'Roundup',
        type: 'defensivo_herbicida',
        toxicityClass: 'IV',
        mapaRegistration: '12345',
        environmentalClass: 'III',
        actionMode: 'sistêmico',
        chemicalGroup: 'glicina substituída',
        withdrawalPeriods: [
          { crop: 'soja', days: 56 },
          { crop: 'milho', days: 30 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.toxicityClass).toBe('IV');
    expect(res.body.environmentalClass).toBe('III');
    expect(res.body.withdrawalPeriods).toHaveLength(2);
    expect(res.body.withdrawalPeriods[0].crop).toBe('soja');
    expect(res.body.withdrawalPeriods[0].days).toBe(56);
    expect(res.body.chemicalGroup).toBe('glicina substituída');
  });

  it('retorna 400 para classe toxicológica inválida', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Classe toxicológica inválida. Use: I, II, III, IV, V', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'X',
        type: 'defensivo_herbicida',
        toxicityClass: 'VI',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Classe toxicológica inválida');
  });

  it('retorna 400 para classe ambiental inválida', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Classe ambiental inválida. Use: I, II, III, IV', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'X',
        type: 'defensivo_herbicida',
        environmentalClass: 'V',
      });

    expect(res.status).toBe(400);
  });
});

describe('CA9: Fertilizantes', () => {
  const FERTILIZANTE_ITEM = {
    ...PRODUCT_ITEM,
    type: 'fertilizante',
    npkFormulation: '04-14-08',
    nutrientForm: 'granulado',
    solubility: 'alta',
    nutrientComposition: { N: 4, P2O5: 14, K2O: 8, S: 5 },
  };

  it('cria fertilizante com campos CA9', async () => {
    mockedService.createProduct.mockResolvedValue(FERTILIZANTE_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'NPK 04-14-08',
        type: 'fertilizante',
        npkFormulation: '04-14-08',
        nutrientForm: 'granulado',
        solubility: 'alta',
        nutrientComposition: { N: 4, P2O5: 14, K2O: 8, S: 5 },
      });

    expect(res.status).toBe(201);
    expect(res.body.npkFormulation).toBe('04-14-08');
    expect(res.body.nutrientForm).toBe('granulado');
    expect(res.body.nutrientComposition.N).toBe(4);
    expect(res.body.nutrientComposition.K2O).toBe(8);
  });

  it('retorna 400 para forma inválida', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Forma do nutriente inválida', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'X',
        type: 'fertilizante',
        nutrientForm: 'pó',
      });

    expect(res.status).toBe(400);
  });
});

describe('CA10: Foliares', () => {
  const FOLIAR_ITEM = {
    ...PRODUCT_ITEM,
    type: 'fertilizante',
    nutritionalComposition: { N: 10, K: 5, Ca: 2, B: 0.5, Mn: 1 },
    sprayCompatibility: {
      compatible: ['Roundup', 'Engeo Pleno'],
      incompatible: ['Calda Bordalesa'],
    },
  };

  it('cria foliar com composição nutricional e compatibilidade de calda', async () => {
    mockedService.createProduct.mockResolvedValue(FOLIAR_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'Foliar NK',
        type: 'fertilizante',
        nutritionalComposition: { N: 10, K: 5, Ca: 2, B: 0.5, Mn: 1 },
        sprayCompatibility: {
          compatible: ['Roundup', 'Engeo Pleno'],
          incompatible: ['Calda Bordalesa'],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.nutritionalComposition.N).toBe(10);
    expect(res.body.sprayCompatibility.compatible).toHaveLength(2);
    expect(res.body.sprayCompatibility.incompatible).toContain('Calda Bordalesa');
  });
});

describe('CA11: Medicamentos veterinários', () => {
  const MED_VET_ITEM = {
    ...PRODUCT_ITEM,
    type: 'medicamento_veterinario',
    therapeuticClass: 'antibiotico',
    administrationRoute: 'IM',
    milkWithdrawalHours: 96,
    slaughterWithdrawalDays: 28,
    vetMapaRegistration: 'V-9876',
    requiresPrescription: true,
    storageCondition: 'refrigerado_2_8',
  };

  it('cria medicamento vet com campos CA11', async () => {
    mockedService.createProduct.mockResolvedValue(MED_VET_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'Terramicina LA',
        type: 'medicamento_veterinario',
        therapeuticClass: 'antibiotico',
        administrationRoute: 'IM',
        milkWithdrawalHours: 96,
        slaughterWithdrawalDays: 28,
        vetMapaRegistration: 'V-9876',
        requiresPrescription: true,
        storageCondition: 'refrigerado_2_8',
      });

    expect(res.status).toBe(201);
    expect(res.body.therapeuticClass).toBe('antibiotico');
    expect(res.body.administrationRoute).toBe('IM');
    expect(res.body.milkWithdrawalHours).toBe(96);
    expect(res.body.slaughterWithdrawalDays).toBe(28);
    expect(res.body.requiresPrescription).toBe(true);
    expect(res.body.storageCondition).toBe('refrigerado_2_8');
  });

  it('retorna 400 para classe terapêutica inválida', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Classe terapêutica inválida', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'X',
        type: 'medicamento_veterinario',
        therapeuticClass: 'invalida',
      });

    expect(res.status).toBe(400);
  });

  it('retorna 400 para via de administração inválida', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Via de administração inválida', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'X',
        type: 'medicamento_veterinario',
        administrationRoute: 'nasal',
      });

    expect(res.status).toBe(400);
  });

  it('retorna 400 para condição de armazenamento inválida', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Condição de armazenamento inválida', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'X',
        type: 'medicamento_veterinario',
        storageCondition: 'qualquer',
      });

    expect(res.status).toBe(400);
  });
});

describe('CA12: Sementes', () => {
  const SEMENTE_ITEM = {
    ...PRODUCT_ITEM,
    type: 'semente',
    cultivarId: 'cult-1',
    cultivarName: 'TMG 2381 IPRO',
    sieveSize: '5.5',
    industrialTreatment: 'Cruiser + Maxim + Derosal',
    germinationPct: 92.5,
    purityPct: 98.0,
  };

  it('cria semente com campos CA12', async () => {
    mockedService.createProduct.mockResolvedValue(SEMENTE_ITEM);

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'Semente Soja TMG 2381',
        type: 'semente',
        cultivarId: 'cult-1',
        sieveSize: '5.5',
        industrialTreatment: 'Cruiser + Maxim + Derosal',
        germinationPct: 92.5,
        purityPct: 98.0,
      });

    expect(res.status).toBe(201);
    expect(res.body.cultivarId).toBe('cult-1');
    expect(res.body.cultivarName).toBe('TMG 2381 IPRO');
    expect(res.body.sieveSize).toBe('5.5');
    expect(res.body.industrialTreatment).toBe('Cruiser + Maxim + Derosal');
    expect(res.body.germinationPct).toBe(92.5);
    expect(res.body.purityPct).toBe(98.0);
  });

  it('retorna 400 para germinação > 100%', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Germinação deve ser entre 0 e 100%', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'X',
        type: 'semente',
        germinationPct: 105,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Germinação');
  });

  it('retorna 400 para pureza negativa', async () => {
    mockedService.createProduct.mockRejectedValue(
      new ProductError('Pureza deve ser entre 0 e 100%', 400),
    );

    const res = await request(app)
      .post('/api/org/products')
      .set('Authorization', 'Bearer tok')
      .send({
        nature: 'PRODUCT',
        name: 'X',
        type: 'semente',
        purityPct: -5,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Pureza');
  });
});
