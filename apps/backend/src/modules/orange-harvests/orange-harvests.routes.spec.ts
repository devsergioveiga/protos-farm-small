import request from 'supertest';
import { app } from '../../app';
import * as orangeHarvestService from './orange-harvests.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { OrangeHarvestError } from './orange-harvests.types';

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

jest.mock('./orange-harvests.service', () => ({
  createOrangeHarvest: jest.fn(),
  listOrangeHarvests: jest.fn(),
  getOrangeHarvest: jest.fn(),
  updateOrangeHarvest: jest.fn(),
  deleteOrangeHarvest: jest.fn(),
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

const mockedService = jest.mocked(orangeHarvestService);
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
  fieldPlotName: 'Talhão Laranja',
  fieldPlotAreaHa: 10,
  cultivarId: 'cultivar-1',
  cultivarName: 'Pera Rio',
  harvestDate: '2026-07-15',
  variety: 'Pera',
  // CA1
  numberOfBoxes: 500,
  totalWeightKg: 20400,
  treesHarvested: 200,
  // CA2
  boxesPerTree: 2.5,
  boxesPerHa: 50,
  tonsPerHa: 2.04,
  // CA3
  ratioSS: 14.5,
  acidityPct: 0.85,
  refusalPct: 3.2,
  // CA4
  destination: 'INDUSTRIA',
  destinationLabel: 'Indústria',
  destinationName: 'Citrosuco',
  // CA5
  numberOfHarvesters: 10,
  harvestersProductivity: 50,
  // CA6
  saleContractRef: 'CT-2026-045',
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-07-15T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const VALID_INPUT = {
  fieldPlotId: 'plot-1',
  cultivarId: 'cultivar-1',
  harvestDate: '2026-07-15',
  variety: 'Pera',
  numberOfBoxes: 500,
  treesHarvested: 200,
  ratioSS: 14.5,
  acidityPct: 0.85,
  refusalPct: 3.2,
  destination: 'INDUSTRIA',
  destinationName: 'Citrosuco',
  numberOfHarvesters: 10,
  saleContractRef: 'CT-2026-045',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /api/org/farms/:farmId/orange-harvests', () => {
  const url = `/api/org/farms/${FARM_ID}/orange-harvests`;

  it('201 — cria colheita de laranja com todos os campos (CA1-CA6)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOrangeHarvest.mockResolvedValue(SAMPLE_HARVEST);

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(HARVEST_ID);
    // CA1
    expect(res.body.variety).toBe('Pera');
    expect(res.body.numberOfBoxes).toBe(500);
    expect(res.body.totalWeightKg).toBe(20400);
    expect(res.body.treesHarvested).toBe(200);
    // CA2
    expect(res.body.boxesPerTree).toBe(2.5);
    expect(res.body.boxesPerHa).toBe(50);
    expect(res.body.tonsPerHa).toBe(2.04);
    // CA3
    expect(res.body.ratioSS).toBe(14.5);
    expect(res.body.acidityPct).toBe(0.85);
    expect(res.body.refusalPct).toBe(3.2);
    // CA4
    expect(res.body.destination).toBe('INDUSTRIA');
    expect(res.body.destinationLabel).toBe('Indústria');
    // CA5
    expect(res.body.numberOfHarvesters).toBe(10);
    expect(res.body.harvestersProductivity).toBe(50);
    // CA6
    expect(res.body.saleContractRef).toBe('CT-2026-045');
    // audit
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_ORANGE_HARVEST' }),
    );
  });

  it('201 — cria colheita sem campos opcionais', async () => {
    authAs(ADMIN_PAYLOAD);
    const minimalHarvest = {
      ...SAMPLE_HARVEST,
      variety: null,
      treesHarvested: null,
      ratioSS: null,
      acidityPct: null,
      refusalPct: null,
      destination: null,
      destinationLabel: null,
      destinationName: null,
      numberOfHarvesters: null,
      harvestersProductivity: null,
      saleContractRef: null,
      boxesPerTree: null,
    };
    mockedService.createOrangeHarvest.mockResolvedValue(minimalHarvest);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ fieldPlotId: 'plot-1', harvestDate: '2026-07-15', numberOfBoxes: 100 });

    expect(res.status).toBe(201);
    expect(res.body.variety).toBeNull();
    expect(res.body.saleContractRef).toBeNull();
  });

  it('400 — numberOfBoxes <= 0', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Número de caixas deve ser maior que zero', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, numberOfBoxes: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/caixas/);
  });

  it('400 — CA3: acidez fora do range', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Acidez deve estar entre 0 e 100', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, acidityPct: 150 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Acidez/);
  });

  it('400 — CA3: refugo fora do range', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Percentual de refugo deve estar entre 0 e 100', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, refusalPct: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refugo/);
  });

  it('400 — CA4: destino inválido', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Destino inválido. Use: INDUSTRIA, IN_NATURA, DESCARTE', 400),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_INPUT, destination: 'INVALIDO' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Destino inválido/);
  });

  it('400 — CA5: número de colhedores <= 0', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Número de colhedores deve ser maior que zero', 400),
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
    mockedService.createOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Fazenda não encontrada', 404),
    );

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(404);
  });

  it('404 — talhão não encontrado', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Talhão não encontrado nesta fazenda', 404),
    );

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send(VALID_INPUT);

    expect(res.status).toBe(404);
  });

  it('404 — cultivar não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Cultivar não encontrada', 404),
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

describe('GET /api/org/farms/:farmId/orange-harvests', () => {
  const url = `/api/org/farms/${FARM_ID}/orange-harvests`;

  it('200 — lista colheitas com paginação', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOrangeHarvests.mockResolvedValue({
      data: [SAMPLE_HARVEST],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('200 — filtra por destino (CA9)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOrangeHarvests.mockResolvedValue({
      data: [SAMPLE_HARVEST],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app)
      .get(`${url}?destination=INDUSTRIA`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listOrangeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ destination: 'INDUSTRIA' }),
    );
  });

  it('200 — filtra por período (CA9)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOrangeHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get(`${url}?dateFrom=2026-07-01&dateTo=2026-07-31`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listOrangeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ dateFrom: '2026-07-01', dateTo: '2026-07-31' }),
    );
  });

  it('200 — filtra por talhão (CA9)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOrangeHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get(`${url}?fieldPlotId=plot-1`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listOrangeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ fieldPlotId: 'plot-1' }),
    );
  });

  it('200 — filtra por contrato de venda (CA6/CA9)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOrangeHarvests.mockResolvedValue({
      data: [SAMPLE_HARVEST],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app)
      .get(`${url}?saleContractRef=CT-2026`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listOrangeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ saleContractRef: 'CT-2026' }),
    );
  });

  it('200 — busca por texto', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOrangeHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get(`${url}?search=citrosuco`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listOrangeHarvests).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ search: 'citrosuco' }),
    );
  });

  it('200 — CONSULTANT pode ler (farms:read)', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listOrangeHarvests.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
  });
});

// ─── DAILY SUMMARY ─────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/orange-harvests/daily-summary', () => {
  const url = `/api/org/farms/${FARM_ID}/orange-harvests/daily-summary`;

  it('200 — retorna totalizador diário por talhão', async () => {
    authAs(ADMIN_PAYLOAD);
    const summary = [
      {
        fieldPlotId: 'plot-1',
        fieldPlotName: 'Talhão Laranja',
        date: '2026-07-15',
        totalBoxes: 1000,
        totalWeightKg: 40800,
        totalHarvesters: 20,
        avgProductivity: 50,
        entries: 2,
      },
    ];
    mockedService.getDailySummary.mockResolvedValue(summary);

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].totalBoxes).toBe(1000);
    expect(res.body[0].totalWeightKg).toBe(40800);
  });

  it('200 — filtra por período e talhão', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getDailySummary.mockResolvedValue([]);

    const res = await request(app)
      .get(`${url}?fieldPlotId=plot-1&dateFrom=2026-07-01&dateTo=2026-07-31`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.getDailySummary).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({
        fieldPlotId: 'plot-1',
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
      }),
    );
  });
});

// ─── GET ────────────────────────────────────────────────────────────

describe('GET /api/org/farms/:farmId/orange-harvests/:harvestId', () => {
  const url = `/api/org/farms/${FARM_ID}/orange-harvests/${HARVEST_ID}`;

  it('200 — retorna detalhe da colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getOrangeHarvest.mockResolvedValue(SAMPLE_HARVEST);

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(HARVEST_ID);
    expect(res.body.numberOfBoxes).toBe(500);
    expect(res.body.variety).toBe('Pera');
  });

  it('404 — colheita não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Colheita não encontrada', 404),
    );

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PATCH /api/org/farms/:farmId/orange-harvests/:harvestId', () => {
  const url = `/api/org/farms/${FARM_ID}/orange-harvests/${HARVEST_ID}`;

  it('200 — atualiza campos da colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_HARVEST, numberOfBoxes: 600, boxesPerHa: 60 };
    mockedService.updateOrangeHarvest.mockResolvedValue(updated);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ numberOfBoxes: 600 });

    expect(res.status).toBe(200);
    expect(res.body.numberOfBoxes).toBe(600);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_ORANGE_HARVEST' }),
    );
  });

  it('200 — atualiza CA3: qualidade', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_HARVEST, ratioSS: 16, acidityPct: 0.7, refusalPct: 2 };
    mockedService.updateOrangeHarvest.mockResolvedValue(updated);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ ratioSS: 16, acidityPct: 0.7, refusalPct: 2 });

    expect(res.status).toBe(200);
    expect(res.body.ratioSS).toBe(16);
    expect(res.body.acidityPct).toBe(0.7);
  });

  it('200 — atualiza CA6: contrato de venda', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_HARVEST, saleContractRef: 'CT-2026-099' };
    mockedService.updateOrangeHarvest.mockResolvedValue(updated);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ saleContractRef: 'CT-2026-099' });

    expect(res.status).toBe(200);
    expect(res.body.saleContractRef).toBe('CT-2026-099');
  });

  it('200 — atualiza destino de INDUSTRIA para IN_NATURA', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = {
      ...SAMPLE_HARVEST,
      destination: 'IN_NATURA',
      destinationLabel: 'Mercado in natura',
      destinationName: 'CEAGESP',
    };
    mockedService.updateOrangeHarvest.mockResolvedValue(updated);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ destination: 'IN_NATURA', destinationName: 'CEAGESP' });

    expect(res.status).toBe(200);
    expect(res.body.destination).toBe('IN_NATURA');
    expect(res.body.destinationLabel).toBe('Mercado in natura');
  });

  it('404 — colheita não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Colheita não encontrada', 404),
    );

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ numberOfBoxes: 600 });

    expect(res.status).toBe(404);
  });

  it('403 — CONSULTANT sem permissão farms:update', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .patch(url)
      .set('Authorization', 'Bearer tok')
      .send({ numberOfBoxes: 600 });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/org/farms/:farmId/orange-harvests/:harvestId', () => {
  const url = `/api/org/farms/${FARM_ID}/orange-harvests/${HARVEST_ID}`;

  it('204 — deleta (soft) colheita', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteOrangeHarvest.mockResolvedValue(undefined);

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_ORANGE_HARVEST' }),
    );
  });

  it('404 — colheita não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteOrangeHarvest.mockRejectedValue(
      new OrangeHarvestError('Colheita não encontrada', 404),
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
