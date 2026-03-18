import request from 'supertest';
import { app } from '../../app';
import * as coffeeHarvestService from './coffee-harvests.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { CoffeeHarvestError } from './coffee-harvests.types';

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

jest.mock('./coffee-harvests.service', () => ({
  createCoffeeHarvest: jest.fn(),
  listCoffeeHarvests: jest.fn(),
  getCoffeeHarvest: jest.fn(),
  updateCoffeeHarvest: jest.fn(),
  deleteCoffeeHarvest: jest.fn(),
  getDailySummary: jest.fn(),
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

const mockedService = jest.mocked(coffeeHarvestService);
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

const SAMPLE_HARVEST = {
  id: HARVEST_ID,
  farmId: FARM_ID,
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão Café',
  fieldPlotAreaHa: 10,
  cultivarId: 'cultivar-1',
  cultivarName: 'Catuaí Vermelho',
  harvestDate: '2026-06-15',
  harvestType: 'DERRICA_MANUAL',
  harvestTypeLabel: 'Derriça manual',
  // CA2
  volumeLiters: 4800,
  sacsBenefited: null,
  estimatedSacs: 10,
  // CA3
  yieldLitersPerSac: 480,
  // CA4
  cherryPct: 60,
  greenPct: 15,
  floaterPct: 10,
  dryPct: 15,
  // CA5
  destination: 'TERREIRO',
  destinationLabel: 'Terreiro',
  destinationName: 'Terreiro principal',
  // CA6
  numberOfHarvesters: 12,
  harvestersProductivity: 400,
  // CA7
  isSpecialLot: false,
  microlotCode: null,
  commercialUnits: { L: 0, sc: 0, kg: 0, arroba: 0, t: 0 },
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-06-15T10:00:00.000Z',
  updatedAt: '2026-06-15T10:00:00.000Z',
};

const VALID_INPUT = {
  fieldPlotId: 'plot-1',
  cultivarId: 'cultivar-1',
  harvestDate: '2026-06-15',
  harvestType: 'DERRICA_MANUAL',
  volumeLiters: 4800,
  cherryPct: 60,
  greenPct: 15,
  floaterPct: 10,
  dryPct: 15,
  destination: 'TERREIRO',
  destinationName: 'Terreiro principal',
  numberOfHarvesters: 12,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /api/org/farms/:farmId/coffee-harvests', () => {
  const url = `/api/org/farms/${FARM_ID}/coffee-harvests`;

  it('201 — cria colheita de café com todos os campos (CA1-CA7)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createCoffeeHarvest.mockResolvedValue(SAMPLE_HARVEST);

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(HARVEST_ID);
    // CA1
    expect(res.body.harvestType).toBe('DERRICA_MANUAL');
    expect(res.body.harvestTypeLabel).toBe('Derriça manual');
    expect(res.body.harvestDate).toBe('2026-06-15');
    // CA2
    expect(res.body.volumeLiters).toBe(4800);
    expect(res.body.estimatedSacs).toBe(10);
    // CA3
    expect(res.body.yieldLitersPerSac).toBe(480);
    // CA4
    expect(res.body.cherryPct).toBe(60);
    expect(res.body.greenPct).toBe(15);
    expect(res.body.floaterPct).toBe(10);
    expect(res.body.dryPct).toBe(15);
    // CA5
    expect(res.body.destination).toBe('TERREIRO');
    expect(res.body.destinationLabel).toBe('Terreiro');
    // CA6
    expect(res.body.numberOfHarvesters).toBe(12);
    expect(res.body.harvestersProductivity).toBe(400);
    // audit
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_COFFEE_HARVEST' }),
    );
  });

  it('201 — CA7: café especial com microlote', async () => {
    authAs(ADMIN_PAYLOAD);
    const specialHarvest = {
      ...SAMPLE_HARVEST,
      isSpecialLot: true,
      microlotCode: 'ML-2026-001',
    };
    mockedService.createCoffeeHarvest.mockResolvedValue(specialHarvest);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({
        ...VALID_INPUT,
        isSpecialLot: true,
        microlotCode: 'ML-2026-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.isSpecialLot).toBe(true);
    expect(res.body.microlotCode).toBe('ML-2026-001');
  });

  it('400 — tipo de colheita inválido', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError(
        'Tipo de colheita inválido. Use: MECANIZADA, DERRICA_MANUAL, SELETIVA_CATACAO',
        400,
      ),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, harvestType: 'INVALIDO' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Tipo de colheita inválido/);
  });

  it('400 — volume <= 0', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError('Volume em litros deve ser maior que zero', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, volumeLiters: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Volume/);
  });

  it('400 — CA4: classificação não soma 100%', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError('A soma dos percentuais de classificação deve ser 100%', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, cherryPct: 50, greenPct: 10, floaterPct: 5, dryPct: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/classificação/);
  });

  it('400 — CA5: destino inválido', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError(
        'Destino inválido. Use: TERREIRO, SECADOR_MECANICO, LAVADOR_SEPARADOR',
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

  it('400 — CA6: número de colhedores <= 0', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError('Número de colhedores deve ser maior que zero', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, numberOfHarvesters: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/colhedores/);
  });

  it('404 — fazenda não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError('Fazenda não encontrada', 404),
    );

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(404);
  });

  it('404 — talhão não encontrado', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError('Talhão não encontrado nesta fazenda', 404),
    );

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(404);
  });

  it('403 — CONSULTANT sem permissão farms:update', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(403);
  });
});

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/coffee-harvests', () => {
  const url = `/api/org/farms/${FARM_ID}/coffee-harvests`;

  it('200 — lista colheitas com paginação', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listCoffeeHarvests.mockResolvedValue({
      data: [SAMPLE_HARVEST],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('200 — filtra por tipo de colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listCoffeeHarvests.mockResolvedValue({
      data: [SAMPLE_HARVEST],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app)
      .get(`${url}?harvestType=DERRICA_MANUAL`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listCoffeeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ harvestType: 'DERRICA_MANUAL' }),
    );
  });

  it('200 — filtra por período', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listCoffeeHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get(`${url}?dateFrom=2026-06-01&dateTo=2026-06-30`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listCoffeeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ dateFrom: '2026-06-01', dateTo: '2026-06-30' }),
    );
  });

  it('200 — filtra por talhão', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listCoffeeHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get(`${url}?fieldPlotId=plot-1`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listCoffeeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ fieldPlotId: 'plot-1' }),
    );
  });

  it('200 — filtra por café especial', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listCoffeeHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get(`${url}?isSpecialLot=true`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listCoffeeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ isSpecialLot: true }),
    );
  });

  it('200 — busca por texto', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listCoffeeHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get(`${url}?search=microlote`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listCoffeeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ search: 'microlote' }),
    );
  });

  it('200 — CONSULTANT pode ler (farms:read)', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listCoffeeHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
  });
});

// ─── DAILY SUMMARY ─────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/coffee-harvests/daily-summary', () => {
  const url = `/api/org/farms/${FARM_ID}/coffee-harvests/daily-summary`;

  it('200 — retorna totalizador diário por talhão', async () => {
    authAs(ADMIN_PAYLOAD);
    const summary = [
      {
        fieldPlotId: 'plot-1',
        fieldPlotName: 'Talhão Café',
        date: '2026-06-15',
        totalVolumeLiters: 9600,
        totalEstimatedSacs: 20,
        totalHarvesters: 24,
        avgProductivity: 400,
        entries: 2,
      },
    ];
    mockedService.getDailySummary.mockResolvedValue(summary);

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].totalVolumeLiters).toBe(9600);
    expect(res.body[0].totalEstimatedSacs).toBe(20);
  });

  it('200 — filtra por período e talhão', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getDailySummary.mockResolvedValue([]);

    const res = await request(app)
      .get(`${url}?fieldPlotId=plot-1&dateFrom=2026-06-01&dateTo=2026-06-30`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.getDailySummary).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({
        fieldPlotId: 'plot-1',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
      }),
    );
  });
});

// ─── GET ────────────────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/coffee-harvests/:harvestId', () => {
  const url = `/api/org/farms/${FARM_ID}/coffee-harvests/${HARVEST_ID}`;

  it('200 — retorna detalhe da colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getCoffeeHarvest.mockResolvedValue(SAMPLE_HARVEST);

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(HARVEST_ID);
    expect(res.body.harvestType).toBe('DERRICA_MANUAL');
    expect(res.body.volumeLiters).toBe(4800);
  });

  it('404 — colheita não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError('Colheita não encontrada', 404),
    );

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PATCH /api/org/farms/:farmId/coffee-harvests/:harvestId', () => {
  const url = `/api/org/farms/${FARM_ID}/coffee-harvests/${HARVEST_ID}`;

  it('200 — atualiza campos da colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_HARVEST, volumeLiters: 5500, estimatedSacs: 11.46 };
    mockedService.updateCoffeeHarvest.mockResolvedValue(updated);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ volumeLiters: 5500 });

    expect(res.status).toBe(200);
    expect(res.body.volumeLiters).toBe(5500);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_COFFEE_HARVEST' }),
    );
  });

  it('200 — atualiza CA3: rendimento e CA4: classificação', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = {
      ...SAMPLE_HARVEST,
      yieldLitersPerSac: 520,
      cherryPct: 70,
      greenPct: 10,
      floaterPct: 10,
      dryPct: 10,
    };
    mockedService.updateCoffeeHarvest.mockResolvedValue(updated);

    const res = await request(app).patch(url).set('Authorization', 'Bearer tok').send({
      yieldLitersPerSac: 520,
      cherryPct: 70,
      greenPct: 10,
      floaterPct: 10,
      dryPct: 10,
    });

    expect(res.status).toBe(200);
    expect(res.body.yieldLitersPerSac).toBe(520);
    expect(res.body.cherryPct).toBe(70);
  });

  it('200 — atualiza CA7: marca como café especial', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_HARVEST, isSpecialLot: true, microlotCode: 'ML-2026-002' };
    mockedService.updateCoffeeHarvest.mockResolvedValue(updated);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ isSpecialLot: true, microlotCode: 'ML-2026-002' });

    expect(res.status).toBe(200);
    expect(res.body.isSpecialLot).toBe(true);
    expect(res.body.microlotCode).toBe('ML-2026-002');
  });

  it('200 — atualiza CA3: sacas beneficiadas (pós-beneficiamento)', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_HARVEST, sacsBenefited: 9.5 };
    mockedService.updateCoffeeHarvest.mockResolvedValue(updated);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ sacsBenefited: 9.5 });

    expect(res.status).toBe(200);
    expect(res.body.sacsBenefited).toBe(9.5);
  });

  it('404 — colheita não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError('Colheita não encontrada', 404),
    );

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ volumeLiters: 5500 });

    expect(res.status).toBe(404);
  });

  it('403 — CONSULTANT sem permissão farms:update', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ volumeLiters: 5500 });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/org/farms/:farmId/coffee-harvests/:harvestId', () => {
  const url = `/api/org/farms/${FARM_ID}/coffee-harvests/${HARVEST_ID}`;

  it('204 — deleta (soft) colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteCoffeeHarvest.mockResolvedValue(undefined);

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_COFFEE_HARVEST' }),
    );
  });

  it('404 — colheita não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteCoffeeHarvest.mockRejectedValue(
      new CoffeeHarvestError('Colheita não encontrada', 404),
    );

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });

  it('403 — CONSULTANT sem permissão', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(403);
  });
});
