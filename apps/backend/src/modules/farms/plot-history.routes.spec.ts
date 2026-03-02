import request from 'supertest';
import { app } from '../../app';
import * as plotHistoryService from './plot-history.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { FarmError } from './farms.types';

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

jest.mock('./plot-history.service', () => ({
  listCropSeasons: jest.fn(),
  createCropSeason: jest.fn(),
  updateCropSeason: jest.fn(),
  deleteCropSeason: jest.fn(),
  listSoilAnalyses: jest.fn(),
  createSoilAnalysis: jest.fn(),
  updateSoilAnalysis: jest.fn(),
  deleteSoilAnalysis: jest.fn(),
  getRotationIndicator: jest.fn(),
  exportPlotHistory: jest.fn(),
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

const mockedService = jest.mocked(plotHistoryService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const BASE_URL = '/api/org/farms/farm-1/plots/plot-1';

function setupAuth(payload = ADMIN_PAYLOAD) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

// ─── Crop Seasons ───────────────────────────────────────────────────

describe('Plot History Routes — Crop Seasons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  describe('GET /crop-seasons', () => {
    it('should return crop seasons list', async () => {
      const seasons = [
        {
          id: 's1',
          plotId: 'plot-1',
          farmId: 'farm-1',
          seasonType: 'SAFRA',
          seasonYear: '2024/2025',
          crop: 'Soja',
          varietyName: null,
          startDate: '2024-10-15',
          endDate: '2025-02-28',
          plantedAreaHa: 100,
          productivityKgHa: 3600,
          totalProductionKg: 360000,
          operations: [],
          notes: null,
          createdBy: 'admin-1',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ];
      mockedService.listCropSeasons.mockResolvedValue(seasons);

      const res = await request(app)
        .get(`${BASE_URL}/crop-seasons`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].crop).toBe('Soja');
    });

    it('should return 404 for non-existent plot', async () => {
      mockedService.listCropSeasons.mockRejectedValue(new FarmError('Talhão não encontrado', 404));

      const res = await request(app)
        .get(`${BASE_URL}/crop-seasons`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get(`${BASE_URL}/crop-seasons`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /crop-seasons', () => {
    const input = {
      seasonType: 'SAFRA',
      seasonYear: '2024/2025',
      crop: 'Soja',
      startDate: '2024-10-15',
      endDate: '2025-02-28',
      productivityKgHa: 3600,
    };

    it('should create a crop season (201)', async () => {
      const created = {
        id: 's1',
        plotId: 'plot-1',
        farmId: 'farm-1',
        ...input,
        varietyName: null,
        plantedAreaHa: null,
        totalProductionKg: null,
        operations: [],
        notes: null,
        createdBy: 'admin-1',
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockedService.createCropSeason.mockResolvedValue(created);

      const res = await request(app)
        .post(`${BASE_URL}/crop-seasons`)
        .set('Authorization', 'Bearer valid-token')
        .send(input);

      expect(res.status).toBe(201);
      expect(res.body.crop).toBe('Soja');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_CROP_SEASON' }),
      );
    });

    it('should return 400 for invalid input', async () => {
      mockedService.createCropSeason.mockRejectedValue(
        new FarmError('Ano da safra e cultura são obrigatórios', 400),
      );

      const res = await request(app)
        .post(`${BASE_URL}/crop-seasons`)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject COWBOY (no farms:update)', async () => {
      setupAuth({ ...ADMIN_PAYLOAD, role: 'COWBOY' as const });

      const res = await request(app)
        .post(`${BASE_URL}/crop-seasons`)
        .set('Authorization', 'Bearer valid-token')
        .send(input);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /crop-seasons/:seasonId', () => {
    it('should update a crop season', async () => {
      const updated = {
        id: 's1',
        plotId: 'plot-1',
        farmId: 'farm-1',
        seasonType: 'SAFRA',
        seasonYear: '2024/2025',
        crop: 'Milho',
        varietyName: null,
        startDate: '2024-10-15',
        endDate: '2025-02-28',
        plantedAreaHa: null,
        productivityKgHa: 3600,
        totalProductionKg: null,
        operations: [],
        notes: null,
        createdBy: 'admin-1',
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockedService.updateCropSeason.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`${BASE_URL}/crop-seasons/s1`)
        .set('Authorization', 'Bearer valid-token')
        .send({ crop: 'Milho' });

      expect(res.status).toBe(200);
      expect(res.body.crop).toBe('Milho');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_CROP_SEASON' }),
      );
    });

    it('should return 404 for non-existent season', async () => {
      mockedService.updateCropSeason.mockRejectedValue(new FarmError('Safra não encontrada', 404));

      const res = await request(app)
        .patch(`${BASE_URL}/crop-seasons/not-found`)
        .set('Authorization', 'Bearer valid-token')
        .send({ crop: 'Milho' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /crop-seasons/:seasonId', () => {
    it('should delete a crop season', async () => {
      mockedService.deleteCropSeason.mockResolvedValue({ deleted: true });

      const res = await request(app)
        .delete(`${BASE_URL}/crop-seasons/s1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_CROP_SEASON' }),
      );
    });

    it('should return 404 for non-existent season', async () => {
      mockedService.deleteCropSeason.mockRejectedValue(new FarmError('Safra não encontrada', 404));

      const res = await request(app)
        .delete(`${BASE_URL}/crop-seasons/not-found`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });
});

// ─── Soil Analyses ──────────────────────────────────────────────────

describe('Plot History Routes — Soil Analyses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  describe('GET /soil-analyses', () => {
    it('should return soil analyses list', async () => {
      const analyses = [
        {
          id: 'a1',
          plotId: 'plot-1',
          farmId: 'farm-1',
          analysisDate: '2024-08-15',
          labName: 'Lab MT',
          sampleDepthCm: '0-20',
          phH2o: 5.8,
          organicMatterPct: 3.2,
          phosphorusMgDm3: 12.5,
          potassiumMgDm3: 85,
          calciumCmolcDm3: 4.2,
          magnesiumCmolcDm3: 1.8,
          aluminumCmolcDm3: 0.1,
          ctcCmolcDm3: 8.5,
          baseSaturationPct: 62,
          sulfurMgDm3: 8,
          clayContentPct: 45,
          notes: null,
          createdBy: 'admin-1',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ];
      mockedService.listSoilAnalyses.mockResolvedValue(analyses);

      const res = await request(app)
        .get(`${BASE_URL}/soil-analyses`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].phH2o).toBe(5.8);
    });
  });

  describe('POST /soil-analyses', () => {
    const input = {
      analysisDate: '2024-08-15',
      labName: 'Lab MT',
      phH2o: 5.8,
      baseSaturationPct: 62,
    };

    it('should create a soil analysis (201)', async () => {
      const created = {
        id: 'a1',
        plotId: 'plot-1',
        farmId: 'farm-1',
        ...input,
        sampleDepthCm: null,
        organicMatterPct: null,
        phosphorusMgDm3: null,
        potassiumMgDm3: null,
        calciumCmolcDm3: null,
        magnesiumCmolcDm3: null,
        aluminumCmolcDm3: null,
        ctcCmolcDm3: null,
        sulfurMgDm3: null,
        clayContentPct: null,
        notes: null,
        createdBy: 'admin-1',
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockedService.createSoilAnalysis.mockResolvedValue(created);

      const res = await request(app)
        .post(`${BASE_URL}/soil-analyses`)
        .set('Authorization', 'Bearer valid-token')
        .send(input);

      expect(res.status).toBe(201);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_SOIL_ANALYSIS' }),
      );
    });

    it('should return 400 for invalid pH', async () => {
      mockedService.createSoilAnalysis.mockRejectedValue(
        new FarmError('pH deve estar entre 0 e 14', 400),
      );

      const res = await request(app)
        .post(`${BASE_URL}/soil-analyses`)
        .set('Authorization', 'Bearer valid-token')
        .send({ analysisDate: '2024-08-15', phH2o: 15 });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /soil-analyses/:analysisId', () => {
    it('should update a soil analysis', async () => {
      const updated = {
        id: 'a1',
        plotId: 'plot-1',
        farmId: 'farm-1',
        analysisDate: '2024-08-15',
        labName: 'Lab MT v2',
        sampleDepthCm: null,
        phH2o: 6.0,
        organicMatterPct: null,
        phosphorusMgDm3: null,
        potassiumMgDm3: null,
        calciumCmolcDm3: null,
        magnesiumCmolcDm3: null,
        aluminumCmolcDm3: null,
        ctcCmolcDm3: null,
        baseSaturationPct: null,
        sulfurMgDm3: null,
        clayContentPct: null,
        notes: null,
        createdBy: 'admin-1',
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockedService.updateSoilAnalysis.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`${BASE_URL}/soil-analyses/a1`)
        .set('Authorization', 'Bearer valid-token')
        .send({ phH2o: 6.0 });

      expect(res.status).toBe(200);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_SOIL_ANALYSIS' }),
      );
    });
  });

  describe('DELETE /soil-analyses/:analysisId', () => {
    it('should delete a soil analysis', async () => {
      mockedService.deleteSoilAnalysis.mockResolvedValue({ deleted: true });

      const res = await request(app)
        .delete(`${BASE_URL}/soil-analyses/a1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });
});

// ─── Rotation Indicator ─────────────────────────────────────────────

describe('Plot History Routes — Rotation Indicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  it('should return rotation indicator', async () => {
    const rotation = {
      level: 2 as const,
      label: 'Rotação simples',
      description: 'Alternância entre Soja e Milho nas últimas 4 safras.',
      uniqueCrops: ['Soja', 'Milho'],
      seasonsAnalyzed: 4,
    };
    mockedService.getRotationIndicator.mockResolvedValue(rotation);

    const res = await request(app)
      .get(`${BASE_URL}/rotation-indicator`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.level).toBe(2);
    expect(res.body.uniqueCrops).toEqual(['Soja', 'Milho']);
  });

  it('should return level 0 for no data', async () => {
    const rotation = {
      level: 0 as const,
      label: 'Sem dados',
      description: 'Nenhuma safra registrada para este talhão.',
      uniqueCrops: [] as string[],
      seasonsAnalyzed: 0,
    };
    mockedService.getRotationIndicator.mockResolvedValue(rotation);

    const res = await request(app)
      .get(`${BASE_URL}/rotation-indicator`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.level).toBe(0);
  });
});

// ─── CSV Export ──────────────────────────────────────────────────────

describe('Plot History Routes — CSV Export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  it('should return CSV file', async () => {
    const csv = '\uFEFFSAFRAS\nTipo;Ano;Cultura\nSAFRA;2024/2025;Soja';
    mockedService.exportPlotHistory.mockResolvedValue(csv);

    const res = await request(app)
      .get(`${BASE_URL}/history/export?format=csv`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.text).toContain('SAFRAS');
  });

  it('should return 404 for non-existent plot', async () => {
    mockedService.exportPlotHistory.mockRejectedValue(new FarmError('Talhão não encontrado', 404));

    const res = await request(app)
      .get(`${BASE_URL}/history/export?format=csv`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
  });
});
