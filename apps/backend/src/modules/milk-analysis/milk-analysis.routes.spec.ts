import request from 'supertest';
import { app } from '../../app';
import * as milkAnalysisService from './milk-analysis.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  MilkAnalysisError,
  type MilkAnalysisItem,
  type QualityConfigItem,
  type HighSccCowItem,
  type QualityTrendItem,
  type BonusCalcResult,
} from './milk-analysis.types';

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

jest.mock('./milk-analysis.service', () => ({
  createAnalysis: jest.fn(),
  listAnalyses: jest.fn(),
  getAnalysis: jest.fn(),
  updateAnalysis: jest.fn(),
  deleteAnalysis: jest.fn(),
  getQualityConfig: jest.fn(),
  setQualityConfig: jest.fn(),
  getHighSccCows: jest.fn(),
  getQualityTrend: jest.fn(),
  calculateBonus: jest.fn(),
  importAnalysesCsv: jest.fn(),
  exportAnalysesCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(milkAnalysisService);
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

const SAMPLE_CMT_ANALYSIS: MilkAnalysisItem = {
  id: 'analysis-1',
  farmId: 'farm-1',
  analysisType: 'INDIVIDUAL_CMT',
  analysisTypeLabel: 'CMT Individual',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  analysisDate: '2026-03-14',
  laboratory: null,
  dairyCompany: null,
  cmtFrontLeft: 'NEGATIVE',
  cmtFrontRight: 'PLUS_2',
  cmtRearLeft: 'NEGATIVE',
  cmtRearRight: 'TRACE',
  cmtAlert: true,
  scc: null,
  tbc: null,
  fatPercent: null,
  proteinPercent: null,
  lactosePercent: null,
  caseinPercent: null,
  totalSolidsPercent: null,
  snfPercent: null,
  munMgDl: null,
  fatProteinRatio: null,
  antibioticResidue: null,
  temperature: null,
  acidityDornic: null,
  cryoscopy: null,
  productionAmLiters: null,
  productionPmLiters: null,
  projected305Liters: null,
  sccAlert: null,
  tbcAlert: null,
  reportFileName: null,
  reportPath: null,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_LAB_ANALYSIS: MilkAnalysisItem = {
  ...SAMPLE_CMT_ANALYSIS,
  id: 'analysis-2',
  analysisType: 'INDIVIDUAL_LAB',
  analysisTypeLabel: 'Laboratório Individual',
  cmtFrontLeft: null,
  cmtFrontRight: null,
  cmtRearLeft: null,
  cmtRearRight: null,
  cmtAlert: false,
  scc: 150000,
  fatPercent: 3.8,
  proteinPercent: 3.2,
  lactosePercent: 4.5,
  fatProteinRatio: 1.19,
  sccAlert: 'GREEN',
  laboratory: 'Lab XYZ',
};

const SAMPLE_TANK_ANALYSIS: MilkAnalysisItem = {
  ...SAMPLE_CMT_ANALYSIS,
  id: 'analysis-3',
  analysisType: 'TANK',
  analysisTypeLabel: 'Análise de Tanque',
  animalId: null,
  animalEarTag: null,
  animalName: null,
  cmtFrontLeft: null,
  cmtFrontRight: null,
  cmtRearLeft: null,
  cmtRearRight: null,
  cmtAlert: false,
  scc: 350000,
  tbc: 180000,
  fatPercent: 3.6,
  proteinPercent: 3.1,
  fatProteinRatio: 1.16,
  antibioticResidue: false,
  temperature: 4.0,
  acidityDornic: 16.5,
  cryoscopy: -0.535,
  sccAlert: 'GREEN',
  tbcAlert: 'GREEN',
  dairyCompany: 'Laticínio ABC',
};

const SAMPLE_QUALITY_CONFIG: QualityConfigItem = {
  id: 'config-1',
  organizationId: 'org-1',
  sccLimit: 500000,
  sccWarning: 400000,
  tbcLimit: 300000,
  tbcWarning: 200000,
  individualSccLimit: 200000,
  bonusTable: null,
};

const SAMPLE_HIGH_SCC_COWS: HighSccCowItem[] = [
  {
    animalId: 'animal-1',
    earTag: '001',
    name: 'Mimosa',
    latestScc: 350000,
    latestDate: '2026-03-14',
    sccHistory: [{ date: '2026-03-14', scc: 350000 }],
    mastitisAlert: true,
  },
];

const SAMPLE_QUALITY_TREND: QualityTrendItem[] = [
  {
    month: '2026-02',
    avgScc: 280000,
    avgTbc: 150000,
    avgFat: 3.6,
    avgProtein: 3.2,
    sampleCount: 5,
  },
  {
    month: '2026-03',
    avgScc: 320000,
    avgTbc: 180000,
    avgFat: 3.5,
    avgProtein: 3.1,
    sampleCount: 3,
  },
];

const SAMPLE_BONUS: BonusCalcResult = {
  month: '2026-03',
  tankAnalysisId: 'analysis-3',
  scc: 350000,
  tbc: 180000,
  fatPercent: 3.6,
  proteinPercent: 3.1,
  bonusDetails: [
    { parameter: 'SCC', value: 350000, bonusPerLiter: 0.02, rangeLabel: '200000 - 400000' },
  ],
  totalBonusPerLiter: 0.02,
};

describe('Milk analysis routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1-CA5) ─────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/milk-analysis', () => {
    const validCmtInput = {
      analysisType: 'INDIVIDUAL_CMT',
      animalId: 'animal-1',
      analysisDate: '2026-03-14',
      cmtFrontLeft: 'NEGATIVE',
      cmtFrontRight: 'PLUS_2',
      cmtRearLeft: 'NEGATIVE',
      cmtRearRight: 'TRACE',
    };

    it('should create CMT analysis and return 201', async () => {
      mockedService.createAnalysis.mockResolvedValue(SAMPLE_CMT_ANALYSIS);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-analysis')
        .set('Authorization', 'Bearer tok')
        .send(validCmtInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('analysis-1');
      expect(res.body.analysisType).toBe('INDIVIDUAL_CMT');
      expect(res.body.cmtAlert).toBe(true);
      expect(mockedService.createAnalysis).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validCmtInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should create lab analysis with SCC alert', async () => {
      mockedService.createAnalysis.mockResolvedValue(SAMPLE_LAB_ANALYSIS);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-analysis')
        .set('Authorization', 'Bearer tok')
        .send({
          analysisType: 'INDIVIDUAL_LAB',
          animalId: 'animal-1',
          analysisDate: '2026-03-14',
          scc: 150000,
          fatPercent: 3.8,
          proteinPercent: 3.2,
          laboratory: 'Lab XYZ',
        });

      expect(res.status).toBe(201);
      expect(res.body.sccAlert).toBe('GREEN');
      expect(res.body.fatProteinRatio).toBe(1.19);
    });

    it('should create tank analysis without animalId', async () => {
      mockedService.createAnalysis.mockResolvedValue(SAMPLE_TANK_ANALYSIS);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-analysis')
        .set('Authorization', 'Bearer tok')
        .send({
          analysisType: 'TANK',
          analysisDate: '2026-03-14',
          scc: 350000,
          tbc: 180000,
          dairyCompany: 'Laticínio ABC',
        });

      expect(res.status).toBe(201);
      expect(res.body.animalId).toBeNull();
      expect(res.body.dairyCompany).toBe('Laticínio ABC');
    });

    it('should return 404 when animal not found', async () => {
      mockedService.createAnalysis.mockRejectedValue(
        new MilkAnalysisError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-analysis')
        .set('Authorization', 'Bearer tok')
        .send(validCmtInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Animal não encontrado');
    });

    it('should return 400 for invalid analysis type', async () => {
      mockedService.createAnalysis.mockRejectedValue(
        new MilkAnalysisError(
          'Tipo de análise inválido. Use INDIVIDUAL_CMT, INDIVIDUAL_LAB, TANK ou OFFICIAL_RECORDING',
          400,
        ),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-analysis')
        .set('Authorization', 'Bearer tok')
        .send({ ...validCmtInput, analysisType: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('should deny access to OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-analysis')
        .set('Authorization', 'Bearer tok')
        .send(validCmtInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milk-analysis', () => {
    it('should list analyses with pagination', async () => {
      mockedService.listAnalyses.mockResolvedValue({
        data: [SAMPLE_CMT_ANALYSIS, SAMPLE_LAB_ANALYSIS],
        total: 2,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-analysis')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter by analysisType', async () => {
      mockedService.listAnalyses.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/milk-analysis?analysisType=TANK')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listAnalyses).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ analysisType: 'TANK' }),
      );
    });

    it('should filter by date range and animalId', async () => {
      mockedService.listAnalyses.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get(
          '/api/org/farms/farm-1/milk-analysis?dateFrom=2026-03-01&dateTo=2026-03-31&animalId=animal-1',
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listAnalyses).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({
          dateFrom: '2026-03-01',
          dateTo: '2026-03-31',
          animalId: 'animal-1',
        }),
      );
    });

    it('should filter by sccAlert', async () => {
      mockedService.listAnalyses.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/milk-analysis?sccAlert=RED')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listAnalyses).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ sccAlert: 'RED' }),
      );
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milk-analysis/:analysisId', () => {
    it('should return analysis by id', async () => {
      mockedService.getAnalysis.mockResolvedValue(SAMPLE_LAB_ANALYSIS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-analysis/analysis-2')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('analysis-2');
      expect(res.body.analysisTypeLabel).toBe('Laboratório Individual');
    });

    it('should return 404 when not found', async () => {
      mockedService.getAnalysis.mockRejectedValue(
        new MilkAnalysisError('Análise de leite não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-analysis/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/milk-analysis/:analysisId', () => {
    it('should update analysis fields', async () => {
      const updated = { ...SAMPLE_LAB_ANALYSIS, scc: 200000, sccAlert: 'GREEN' as const };
      mockedService.updateAnalysis.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/milk-analysis/analysis-2')
        .set('Authorization', 'Bearer tok')
        .send({ scc: 200000 });

      expect(res.status).toBe(200);
      expect(res.body.scc).toBe(200000);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.updateAnalysis.mockRejectedValue(
        new MilkAnalysisError('Análise de leite não encontrada', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/milk-analysis/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ scc: 200000 });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/milk-analysis/:analysisId', () => {
    it('should delete analysis', async () => {
      mockedService.deleteAnalysis.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milk-analysis/analysis-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Análise de leite excluída com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deleteAnalysis.mockRejectedValue(
        new MilkAnalysisError('Análise de leite não encontrada', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milk-analysis/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milk-analysis/analysis-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── QUALITY CONFIG (CA6) ────────────────────────────────────────

  describe('GET /api/org/milk-analysis/quality-config', () => {
    it('should return quality config', async () => {
      mockedService.getQualityConfig.mockResolvedValue(SAMPLE_QUALITY_CONFIG);

      const res = await request(app)
        .get('/api/org/milk-analysis/quality-config')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.sccLimit).toBe(500000);
      expect(res.body.tbcLimit).toBe(300000);
      expect(res.body.individualSccLimit).toBe(200000);
    });
  });

  describe('PUT /api/org/milk-analysis/quality-config', () => {
    it('should set quality config', async () => {
      const updated = { ...SAMPLE_QUALITY_CONFIG, sccLimit: 400000 };
      mockedService.setQualityConfig.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/org/milk-analysis/quality-config')
        .set('Authorization', 'Bearer tok')
        .send({ sccLimit: 400000 });

      expect(res.status).toBe(200);
      expect(res.body.sccLimit).toBe(400000);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .put('/api/org/milk-analysis/quality-config')
        .set('Authorization', 'Bearer tok')
        .send({ sccLimit: 400000 });

      expect(res.status).toBe(403);
    });
  });

  // ─── HIGH SCC COWS (CA7) ─────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milk-analysis/high-scc', () => {
    it('should return cows with high SCC', async () => {
      mockedService.getHighSccCows.mockResolvedValue(SAMPLE_HIGH_SCC_COWS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-analysis/high-scc')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].earTag).toBe('001');
      expect(res.body[0].latestScc).toBe(350000);
      expect(res.body[0].mastitisAlert).toBe(true);
    });
  });

  // ─── QUALITY TREND (CA8) ─────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milk-analysis/quality-trend', () => {
    it('should return quality trend', async () => {
      mockedService.getQualityTrend.mockResolvedValue(SAMPLE_QUALITY_TREND);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-analysis/quality-trend')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].month).toBe('2026-02');
      expect(res.body[0].avgScc).toBe(280000);
    });

    it('should accept months query param', async () => {
      mockedService.getQualityTrend.mockResolvedValue(SAMPLE_QUALITY_TREND);

      await request(app)
        .get('/api/org/farms/farm-1/milk-analysis/quality-trend?months=6')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getQualityTrend).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        6,
      );
    });
  });

  // ─── BONUS CALCULATION (CA9) ─────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milk-analysis/bonus', () => {
    it('should calculate bonus/penalty', async () => {
      mockedService.calculateBonus.mockResolvedValue(SAMPLE_BONUS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-analysis/bonus')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.month).toBe('2026-03');
      expect(res.body.totalBonusPerLiter).toBe(0.02);
      expect(res.body.bonusDetails).toHaveLength(1);
    });

    it('should accept month query param', async () => {
      mockedService.calculateBonus.mockResolvedValue(SAMPLE_BONUS);

      await request(app)
        .get('/api/org/farms/farm-1/milk-analysis/bonus?month=2026-02')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.calculateBonus).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        '2026-02',
      );
    });
  });

  // ─── IMPORT CSV (CA10) ───────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/milk-analysis/import', () => {
    it('should import CSV and return 201', async () => {
      mockedService.importAnalysesCsv.mockResolvedValue({ imported: 5, errors: [] });

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-analysis/import')
        .set('Authorization', 'Bearer tok')
        .send({ csvContent: 'brinco;data;ccs\n001;2026-03-14;150000' });

      expect(res.status).toBe(201);
      expect(res.body.imported).toBe(5);
      expect(res.body.errors).toEqual([]);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 when csvContent is missing', async () => {
      mockedService.importAnalysesCsv.mockRejectedValue(
        new MilkAnalysisError('Conteúdo CSV é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-analysis/import')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return import errors in response', async () => {
      mockedService.importAnalysesCsv.mockResolvedValue({
        imported: 3,
        errors: ['Linha 5: animal com brinco "999" não encontrado'],
      });

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-analysis/import')
        .set('Authorization', 'Bearer tok')
        .send({ csvContent: 'brinco;data;ccs\n001;2026-03-14;150000' });

      expect(res.status).toBe(201);
      expect(res.body.imported).toBe(3);
      expect(res.body.errors).toHaveLength(1);
    });
  });

  // ─── EXPORT CSV ──────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milk-analysis/export', () => {
    it('should return CSV with correct headers', async () => {
      const csv = '\uFEFFRELATÓRIO DE ANÁLISE DE LEITE\nData;Tipo;Brinco';
      mockedService.exportAnalysesCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-analysis/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('analise-leite-');
      expect(res.text).toContain('RELATÓRIO DE ANÁLISE DE LEITE');
    });

    it('should pass filter params to export', async () => {
      mockedService.exportAnalysesCsv.mockResolvedValue('\uFEFF');

      await request(app)
        .get('/api/org/farms/farm-1/milk-analysis/export?analysisType=TANK&dateFrom=2026-03-01')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.exportAnalysesCsv).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ analysisType: 'TANK', dateFrom: '2026-03-01' }),
      );
    });
  });
});
