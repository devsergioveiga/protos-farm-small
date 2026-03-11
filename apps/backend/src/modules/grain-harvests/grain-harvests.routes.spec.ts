import request from 'supertest';
import { app } from '../../app';
import * as grainHarvestService from './grain-harvests.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { GrainHarvestError } from './grain-harvests.types';

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

jest.mock('./grain-harvests.service', () => ({
  createGrainHarvest: jest.fn(),
  listGrainHarvests: jest.fn(),
  getGrainHarvest: jest.fn(),
  updateGrainHarvest: jest.fn(),
  deleteGrainHarvest: jest.fn(),
  getCostSummary: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(grainHarvestService);
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

const FARM_ID = 'farm-1';
const HARVEST_ID = 'harvest-1';

// CA2: Soja 55800kg bruto, 14.5% umidade, 1.2% impureza, 15.5ha
// net = 55800 * (1 - 1.2/100) = 55130.4
// corrected = 55130.4 * (100 - 14.5) / (100 - 13) = 55130.4 * 85.5 / 87 = 54178.73
// sc = 54178.73 / 60 = 902.98
// sc/ha = 902.98 / 15.5 = 58.26
const SAMPLE_HARVEST = {
  id: HARVEST_ID,
  farmId: FARM_ID,
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão Norte',
  fieldPlotAreaHa: 15.5,
  cultivarId: 'cultivar-1',
  cultivarName: 'TMG 2381',
  crop: 'Soja',
  harvestDate: '2026-03-10',
  loadNumber: 1,
  harvestedAreaHa: 15.5,
  grossProductionKg: 55800,
  moisturePct: 14.5,
  impurityPct: 1.2,
  standardMoisturePct: 13,
  netProductionKg: 55130.4,
  correctedProductionKg: 54178.73,
  productionSc: 902.98,
  productivityScHa: 58.26,
  harvesterName: null,
  operatorName: null,
  destination: null,
  destinationLabel: null,
  destinationName: null,
  romaneioNumber: null,
  grossWeightKg: null,
  tareWeightKg: null,
  netWeightKg: null,
  weighingMethod: null,
  harvesterHours: null,
  harvesterCostPerHour: null,
  transhipmentCost: null,
  transportCost: null,
  totalHarvestCost: null,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T10:00:00.000Z',
};

const VALID_INPUT = {
  fieldPlotId: 'plot-1',
  cultivarId: 'cultivar-1',
  crop: 'Soja',
  harvestDate: '2026-03-10',
  harvestedAreaHa: 15.5,
  grossProductionKg: 55800,
  moisturePct: 14.5,
  impurityPct: 1.2,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /api/org/farms/:farmId/grain-harvests', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests`;

  it('201 — cria colheita de grãos com campos CA2 de produtividade', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createGrainHarvest.mockResolvedValue(SAMPLE_HARVEST);

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(HARVEST_ID);
    expect(res.body.crop).toBe('Soja');
    expect(res.body.harvestedAreaHa).toBe(15.5);
    expect(res.body.grossProductionKg).toBe(55800);
    expect(res.body.moisturePct).toBe(14.5);
    expect(res.body.impurityPct).toBe(1.2);
    // CA2 — computed fields
    expect(res.body.standardMoisturePct).toBe(13);
    expect(res.body.netProductionKg).toBe(55130.4);
    expect(res.body.correctedProductionKg).toBe(54178.73);
    expect(res.body.productionSc).toBe(902.98);
    expect(res.body.productivityScHa).toBe(58.26);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_GRAIN_HARVEST' }),
    );
  });

  it('400 — validação (área <= 0)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createGrainHarvest.mockRejectedValue(
      new GrainHarvestError('Área colhida deve ser maior que zero', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, harvestedAreaHa: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Área colhida/);
  });

  it('400 — validação (umidade > 100)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createGrainHarvest.mockRejectedValue(
      new GrainHarvestError('Umidade deve estar entre 0 e 100%', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, moisturePct: 120 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Umidade/);
  });

  it('403 — CONSULTANT sem permissão farms:update', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(403);
  });

  it('404 — talhão não encontrado', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createGrainHarvest.mockRejectedValue(
      new GrainHarvestError('Talhão não encontrado nesta fazenda', 404),
    );

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(404);
  });
});

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/grain-harvests', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests`;

  it('200 — lista colheitas com paginação', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listGrainHarvests.mockResolvedValue({
      data: [SAMPLE_HARVEST],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('200 — filtros de query (fieldPlotId, crop, dateFrom, dateTo)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listGrainHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await request(app)
      .get(`${url}?fieldPlotId=plot-1&crop=Soja&dateFrom=2026-01-01&dateTo=2026-12-31`)
      .set('Authorization', 'Bearer tok');

    expect(mockedService.listGrainHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({
        fieldPlotId: 'plot-1',
        crop: 'Soja',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      }),
    );
  });

  it('200 — CONSULTANT pode listar (farms:read)', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listGrainHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
  });
});

// ─── GET ────────────────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/grain-harvests/:harvestId', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests/${HARVEST_ID}`;

  it('200 — retorna colheita por id', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getGrainHarvest.mockResolvedValue(SAMPLE_HARVEST);

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(HARVEST_ID);
  });

  it('404 — não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getGrainHarvest.mockRejectedValue(
      new GrainHarvestError('Colheita não encontrada', 404),
    );

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PATCH /api/org/farms/:farmId/grain-harvests/:harvestId', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests/${HARVEST_ID}`;

  it('200 — atualiza colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateGrainHarvest.mockResolvedValue({
      ...SAMPLE_HARVEST,
      moisturePct: 13.0,
    });

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ moisturePct: 13.0 });

    expect(res.status).toBe(200);
    expect(res.body.moisturePct).toBe(13.0);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_GRAIN_HARVEST' }),
    );
  });

  it('403 — CONSULTANT sem permissão', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ moisturePct: 13.0 });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/org/farms/:farmId/grain-harvests/:harvestId', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests/${HARVEST_ID}`;

  it('204 — exclui colheita (soft delete)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteGrainHarvest.mockResolvedValue(undefined);

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_GRAIN_HARVEST' }),
    );
  });

  it('404 — não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteGrainHarvest.mockRejectedValue(
      new GrainHarvestError('Colheita não encontrada', 404),
    );

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });
});

// ─── CA2 — Produtividade por cultura ────────────────────────────────

describe('CA2 — campos de produtividade retornados por cultura', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests`;

  it('Milho usa umidade padrão 14%', async () => {
    authAs(ADMIN_PAYLOAD);
    // Milho: 80000kg bruto, 18% umid, 2% impureza, 20ha
    // net = 80000 * 0.98 = 78400
    // corrected = 78400 * 82 / 86 = 74753.49
    // sc = 74753.49 / 60 = 1245.89
    // sc/ha = 1245.89 / 20 = 62.29
    const milhoHarvest = {
      ...SAMPLE_HARVEST,
      crop: 'Milho',
      grossProductionKg: 80000,
      moisturePct: 18,
      impurityPct: 2,
      harvestedAreaHa: 20,
      standardMoisturePct: 14,
      netProductionKg: 78400,
      correctedProductionKg: 74753.49,
      productionSc: 1245.89,
      productivityScHa: 62.29,
    };
    mockedService.createGrainHarvest.mockResolvedValue(milhoHarvest);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({
        ...VALID_INPUT,
        crop: 'Milho',
        grossProductionKg: 80000,
        moisturePct: 18,
        impurityPct: 2,
        harvestedAreaHa: 20,
      });

    expect(res.status).toBe(201);
    expect(res.body.standardMoisturePct).toBe(14);
    expect(res.body.productivityScHa).toBe(62.29);
  });

  it('Trigo usa umidade padrão 13%', async () => {
    authAs(ADMIN_PAYLOAD);
    const trigoHarvest = {
      ...SAMPLE_HARVEST,
      crop: 'Trigo',
      standardMoisturePct: 13,
    };
    mockedService.createGrainHarvest.mockResolvedValue(trigoHarvest);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, crop: 'Trigo' });

    expect(res.status).toBe(201);
    expect(res.body.standardMoisturePct).toBe(13);
  });

  it('Feijão usa umidade padrão 13%', async () => {
    authAs(ADMIN_PAYLOAD);
    const feijaoHarvest = {
      ...SAMPLE_HARVEST,
      crop: 'Feijão',
      standardMoisturePct: 13,
    };
    mockedService.createGrainHarvest.mockResolvedValue(feijaoHarvest);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, crop: 'Feijão' });

    expect(res.status).toBe(201);
    expect(res.body.standardMoisturePct).toBe(13);
  });
});

// ─── CA4 — Colheitadeira e operador ─────────────────────────────────

describe('CA4 — colheitadeira e operador registrados', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests`;

  it('201 — cria colheita com colheitadeira e operador', async () => {
    authAs(ADMIN_PAYLOAD);
    const harvestWithMachine = {
      ...SAMPLE_HARVEST,
      harvesterName: 'John Deere S790',
      operatorName: 'João Silva',
    };
    mockedService.createGrainHarvest.mockResolvedValue(harvestWithMachine);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, harvesterName: 'John Deere S790', operatorName: 'João Silva' });

    expect(res.status).toBe(201);
    expect(res.body.harvesterName).toBe('John Deere S790');
    expect(res.body.operatorName).toBe('João Silva');
  });

  it('200 — atualiza operador da colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = {
      ...SAMPLE_HARVEST,
      harvesterName: 'Case IH 8250',
      operatorName: 'Pedro Santos',
    };
    mockedService.updateGrainHarvest.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`${url}/${HARVEST_ID}`)
      .set('Authorization', 'Bearer tok')
      .send({ harvesterName: 'Case IH 8250', operatorName: 'Pedro Santos' });

    expect(res.status).toBe(200);
    expect(res.body.harvesterName).toBe('Case IH 8250');
    expect(res.body.operatorName).toBe('Pedro Santos');
  });
});

// ─── CA5 — Destino da produção ──────────────────────────────────────

describe('CA5 — destino da produção', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests`;

  it('201 — silo próprio', async () => {
    authAs(ADMIN_PAYLOAD);
    const harvest = {
      ...SAMPLE_HARVEST,
      destination: 'SILO_PROPRIO',
      destinationLabel: 'Silo próprio',
      destinationName: 'Silo Fazenda Norte',
      romaneioNumber: null,
    };
    mockedService.createGrainHarvest.mockResolvedValue(harvest);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, destination: 'SILO_PROPRIO', destinationName: 'Silo Fazenda Norte' });

    expect(res.status).toBe(201);
    expect(res.body.destination).toBe('SILO_PROPRIO');
    expect(res.body.destinationLabel).toBe('Silo próprio');
    expect(res.body.destinationName).toBe('Silo Fazenda Norte');
  });

  it('201 — venda direta com romaneio', async () => {
    authAs(ADMIN_PAYLOAD);
    const harvest = {
      ...SAMPLE_HARVEST,
      destination: 'VENDA_DIRETA',
      destinationLabel: 'Venda direta',
      destinationName: 'Cargill Uberlândia',
      romaneioNumber: 'ROM-2026-00142',
    };
    mockedService.createGrainHarvest.mockResolvedValue(harvest);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({
        ...VALID_INPUT,
        destination: 'VENDA_DIRETA',
        destinationName: 'Cargill Uberlândia',
        romaneioNumber: 'ROM-2026-00142',
      });

    expect(res.status).toBe(201);
    expect(res.body.destination).toBe('VENDA_DIRETA');
    expect(res.body.romaneioNumber).toBe('ROM-2026-00142');
  });

  it('400 — destino inválido', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createGrainHarvest.mockRejectedValue(
      new GrainHarvestError(
        'Destino inválido. Use: SILO_PROPRIO, ARMAZEM_TERCEIRO, VENDA_DIRETA',
        400,
      ),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, destination: 'INVALIDO' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Destino inválido/);
  });
});

// ─── CA6 — Pesagem ──────────────────────────────────────────────────

describe('CA6 — pesagem (peso bruto, tara, líquido)', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests`;

  it('201 — pesagem manual com cálculo automático de peso líquido', async () => {
    authAs(ADMIN_PAYLOAD);
    // bruto=32500, tara=12500 → líquido=20000
    const harvest = {
      ...SAMPLE_HARVEST,
      grossWeightKg: 32500,
      tareWeightKg: 12500,
      netWeightKg: 20000,
      weighingMethod: 'MANUAL',
    };
    mockedService.createGrainHarvest.mockResolvedValue(harvest);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({
        ...VALID_INPUT,
        grossWeightKg: 32500,
        tareWeightKg: 12500,
        weighingMethod: 'MANUAL',
      });

    expect(res.status).toBe(201);
    expect(res.body.grossWeightKg).toBe(32500);
    expect(res.body.tareWeightKg).toBe(12500);
    expect(res.body.netWeightKg).toBe(20000);
    expect(res.body.weighingMethod).toBe('MANUAL');
  });

  it('201 — pesagem por balança', async () => {
    authAs(ADMIN_PAYLOAD);
    const harvest = {
      ...SAMPLE_HARVEST,
      grossWeightKg: 45000,
      tareWeightKg: 15000,
      netWeightKg: 30000,
      weighingMethod: 'BALANCA',
    };
    mockedService.createGrainHarvest.mockResolvedValue(harvest);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({
        ...VALID_INPUT,
        grossWeightKg: 45000,
        tareWeightKg: 15000,
        weighingMethod: 'BALANCA',
      });

    expect(res.status).toBe(201);
    expect(res.body.weighingMethod).toBe('BALANCA');
    expect(res.body.netWeightKg).toBe(30000);
  });

  it('400 — tara >= peso bruto', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createGrainHarvest.mockRejectedValue(
      new GrainHarvestError('Tara deve ser menor que o peso bruto', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, grossWeightKg: 10000, tareWeightKg: 10000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Tara deve ser menor/);
  });

  it('400 — método de pesagem inválido', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createGrainHarvest.mockRejectedValue(
      new GrainHarvestError('Método de pesagem inválido. Use: MANUAL, BALANCA', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, weighingMethod: 'DIGITAL' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Método de pesagem inválido/);
  });
});

// ─── CA7 — Múltiplas cargas por talhão ──────────────────────────────

describe('CA7 — múltiplas cargas por talhão', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests`;

  it('201 — loadNumber retornado na criação', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createGrainHarvest.mockResolvedValue({ ...SAMPLE_HARVEST, loadNumber: 3 });

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.loadNumber).toBe(3);
  });

  it('200 — lista com plotSummary quando filtrado por fieldPlotId', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listGrainHarvests.mockResolvedValue({
      data: [SAMPLE_HARVEST, { ...SAMPLE_HARVEST, id: 'h-2', loadNumber: 2 }],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      plotSummary: {
        fieldPlotId: 'plot-1',
        fieldPlotName: 'Talhão Norte',
        totalLoads: 2,
        totalGrossProductionKg: 111600,
        totalHarvestedAreaHa: 31,
      },
    } as ReturnType<typeof mockedService.listGrainHarvests> extends Promise<infer T> ? T : never);

    const res = await request(app)
      .get(`${url}?fieldPlotId=plot-1`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.plotSummary.totalLoads).toBe(2);
    expect(res.body.plotSummary.totalGrossProductionKg).toBe(111600);
  });
});

// ─── CA8 — Talhão muda status para Colhido ─────────────────────────

describe('CA8 — talhão muda status para Colhido', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests`;

  it('201 — cria colheita com harvestComplete=true', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createGrainHarvest.mockResolvedValue(SAMPLE_HARVEST);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, harvestComplete: true });

    expect(res.status).toBe(201);
    expect(mockedService.createGrainHarvest).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      ADMIN_PAYLOAD.userId,
      expect.objectContaining({ harvestComplete: true }),
    );
  });

  it('200 — update com harvestComplete=true', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateGrainHarvest.mockResolvedValue(SAMPLE_HARVEST);

    const res = await request(app)
      .patch(`${url}/${HARVEST_ID}`)
      .set('Authorization', 'Bearer tok')
      .send({ harvestComplete: true });

    expect(res.status).toBe(200);
    expect(mockedService.updateGrainHarvest).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      HARVEST_ID,
      expect.objectContaining({ harvestComplete: true }),
    );
  });
});

// ─── CA9 — Custo de colheita ────────────────────────────────────────

describe('CA9 — custo de colheita', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests`;

  it('201 — cria colheita com custos (horas colheitadeira + transbordo + transporte)', async () => {
    authAs(ADMIN_PAYLOAD);
    const harvestWithCost = {
      ...SAMPLE_HARVEST,
      harvesterHours: 4.5,
      harvesterCostPerHour: 350,
      transhipmentCost: 800,
      transportCost: 1200,
      totalHarvestCost: 3575, // 4.5*350 + 800 + 1200
    };
    mockedService.createGrainHarvest.mockResolvedValue(harvestWithCost);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({
        ...VALID_INPUT,
        harvesterHours: 4.5,
        harvesterCostPerHour: 350,
        transhipmentCost: 800,
        transportCost: 1200,
      });

    expect(res.status).toBe(201);
    expect(res.body.harvesterHours).toBe(4.5);
    expect(res.body.harvesterCostPerHour).toBe(350);
    expect(res.body.transhipmentCost).toBe(800);
    expect(res.body.transportCost).toBe(1200);
    expect(res.body.totalHarvestCost).toBe(3575);
  });

  it('200 — atualiza custos de colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = {
      ...SAMPLE_HARVEST,
      harvesterHours: 6,
      harvesterCostPerHour: 400,
      transhipmentCost: 1000,
      transportCost: 1500,
      totalHarvestCost: 4900, // 6*400 + 1000 + 1500
    };
    mockedService.updateGrainHarvest.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`${url}/${HARVEST_ID}`)
      .set('Authorization', 'Bearer tok')
      .send({
        harvesterHours: 6,
        harvesterCostPerHour: 400,
        transhipmentCost: 1000,
        transportCost: 1500,
      });

    expect(res.status).toBe(200);
    expect(res.body.totalHarvestCost).toBe(4900);
  });
});

describe('CA9 — cost-summary endpoint', () => {
  const url = `/api/org/farms/${FARM_ID}/grain-harvests/cost-summary`;

  it('200 — retorna resumo de custos por talhão', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getCostSummary.mockResolvedValue([
      {
        fieldPlotId: 'plot-1',
        fieldPlotName: 'Talhão Norte',
        totalLoads: 3,
        totalHarvestedAreaHa: 45,
        totalHarvesterCost: 4725,
        totalTranshipmentCost: 2400,
        totalTransportCost: 3600,
        totalCost: 10725,
        costPerHa: 238.33,
        costPerSc: 3.96,
        totalProductionSc: 2708.94,
      },
    ]);

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].fieldPlotId).toBe('plot-1');
    expect(res.body[0].totalCost).toBe(10725);
    expect(res.body[0].costPerHa).toBe(238.33);
    expect(res.body[0].costPerSc).toBe(3.96);
  });

  it('200 — filtro por período (dateFrom, dateTo)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getCostSummary.mockResolvedValue([]);

    await request(app)
      .get(`${url}?dateFrom=2026-03-01&dateTo=2026-03-31`)
      .set('Authorization', 'Bearer tok');

    expect(mockedService.getCostSummary).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ dateFrom: '2026-03-01', dateTo: '2026-03-31' }),
    );
  });

  it('200 — CONSULTANT pode acessar (farms:read)', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.getCostSummary.mockResolvedValue([]);

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
  });
});
