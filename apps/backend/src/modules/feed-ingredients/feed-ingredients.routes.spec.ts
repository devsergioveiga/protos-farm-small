import request from 'supertest';
import { app } from '../../app';
import * as feedIngredientsService from './feed-ingredients.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  FeedIngredientError,
  type FeedIngredientItem,
  type AnalysisItem,
  type ComparisonResult,
  type QualityTrendResult,
  type ImportAnalysesResult,
} from './feed-ingredients.types';

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

jest.mock('./feed-ingredients.service', () => ({
  createFeedIngredient: jest.fn(),
  listFeedIngredients: jest.fn(),
  getFeedIngredient: jest.fn(),
  updateFeedIngredient: jest.fn(),
  deleteFeedIngredient: jest.fn(),
  createAnalysis: jest.fn(),
  listAnalyses: jest.fn(),
  getAnalysis: jest.fn(),
  updateAnalysis: jest.fn(),
  deleteAnalysis: jest.fn(),
  getLatestAnalysis: jest.fn(),
  compareWithReference: jest.fn(),
  importAnalysesCsv: jest.fn(),
  getQualityTrend: jest.fn(),
  uploadAnalysisReport: jest.fn(),
  getAnalysisReportFile: jest.fn(),
  exportIngredientsCsv: jest.fn(),
  exportAnalysesCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(feedIngredientsService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const CONSULTANT_PAYLOAD = {
  userId: 'consult-1',
  email: 'consult@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const SAMPLE_INGREDIENT: FeedIngredientItem = {
  id: 'fi-1',
  organizationId: 'org-1',
  name: 'Silagem de Milho',
  type: 'ROUGHAGE',
  typeLabel: 'Volumoso',
  subtype: 'silagem_milho',
  measurementUnit: 'kg',
  costPerKg: 0.35,
  refDmPercent: 33,
  refCpPercent: 7.5,
  refNdfPercent: 45,
  refAdfPercent: 26,
  refEePercent: 3.2,
  refMmPercent: 4.5,
  refTdnPercent: 65,
  refNelMcalKg: 1.48,
  refNfcPercent: 40,
  refCaPercent: 0.28,
  refPPercent: 0.22,
  refMgPercent: 0.18,
  refKPercent: 1.1,
  refNaPercent: 0.01,
  analysisCount: 3,
  latestAnalysisDate: '2026-03-10',
  notes: null,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
};

const SAMPLE_ANALYSIS: AnalysisItem = {
  id: 'ba-1',
  organizationId: 'org-1',
  feedIngredientId: 'fi-1',
  feedIngredientName: 'Silagem de Milho',
  batchNumber: 'LOTE-2026-A',
  collectionDate: '2026-03-10',
  resultDate: '2026-03-12',
  laboratory: 'Lab Nutrição Animal',
  protocolNumber: 'PROT-001',
  responsibleName: 'João Silva',
  dmPercent: 34.5,
  cpPercent: 7.8,
  ndfPercent: 43.2,
  adfPercent: 25.1,
  eePercent: 3.1,
  mmPercent: 4.3,
  tdnPercent: 66.2,
  nelMcalKg: 1.52,
  nfcPercent: 41.6,
  caPercent: 0.3,
  pPercent: 0.24,
  mgPercent: 0.19,
  kPercent: 1.15,
  naPercent: 0.01,
  reportFileName: null,
  reportPath: null,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T10:00:00.000Z',
};

const SAMPLE_COMPARISON: ComparisonResult = {
  analysisId: 'ba-1',
  feedIngredientId: 'fi-1',
  feedIngredientName: 'Silagem de Milho',
  comparisons: [
    {
      param: 'dmPercent',
      label: 'Matéria Seca (%)',
      referenceValue: 33,
      analysisValue: 34.5,
      deviationPercent: 4.5,
      level: 'NORMAL',
    },
    {
      param: 'cpPercent',
      label: 'Proteína Bruta (%)',
      referenceValue: 7.5,
      analysisValue: 7.8,
      deviationPercent: 4.0,
      level: 'NORMAL',
    },
  ],
};

const SAMPLE_TREND: QualityTrendResult = {
  feedIngredientId: 'fi-1',
  feedIngredientName: 'Silagem de Milho',
  points: [
    {
      analysisId: 'ba-1',
      collectionDate: '2026-03-01',
      dmPercent: 33,
      cpPercent: 7.5,
      ndfPercent: 45,
      tdnPercent: 65,
      nelMcalKg: 1.48,
      costPerKgDm: 1.06,
      costPerKgCp: 14.14,
    },
  ],
};

const SAMPLE_IMPORT: ImportAnalysesResult = {
  imported: 5,
  skipped: 1,
  errors: ['Linha 7: alimento "Feno X" não encontrado'],
};

describe('Feed ingredients routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ═══════════════════════════════════════════════════════════════
  // FEED INGREDIENTS CRUD
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/org/feed-ingredients', () => {
    const validInput = {
      name: 'Silagem de Milho',
      type: 'ROUGHAGE',
      subtype: 'silagem_milho',
      costPerKg: 0.35,
      refDmPercent: 33,
      refCpPercent: 7.5,
    };

    it('should create feed ingredient and return 201', async () => {
      mockedService.createFeedIngredient.mockResolvedValue(SAMPLE_INGREDIENT);

      const res = await request(app)
        .post('/api/org/feed-ingredients')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('fi-1');
      expect(res.body.name).toBe('Silagem de Milho');
      expect(res.body.typeLabel).toBe('Volumoso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing name', async () => {
      mockedService.createFeedIngredient.mockRejectedValue(
        new FeedIngredientError('Nome é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/feed-ingredients')
        .set('Authorization', 'Bearer tok')
        .send({ type: 'ROUGHAGE' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Nome');
    });

    it('should return 400 for invalid type', async () => {
      mockedService.createFeedIngredient.mockRejectedValue(
        new FeedIngredientError(
          'Tipo inválido. Use: ROUGHAGE, CONCENTRATE, MINERAL, ADDITIVE, BYPRODUCT',
          400,
        ),
      );

      const res = await request(app)
        .post('/api/org/feed-ingredients')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Test', type: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('should return 409 for duplicate name', async () => {
      mockedService.createFeedIngredient.mockRejectedValue(
        new FeedIngredientError('Já existe um alimento/ingrediente com este nome', 409),
      );

      const res = await request(app)
        .post('/api/org/feed-ingredients')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(409);
    });

    it('should return 403 for CONSULTANT role (no animals:update)', async () => {
      authAs(CONSULTANT_PAYLOAD);

      const res = await request(app)
        .post('/api/org/feed-ingredients')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/org/feed-ingredients', () => {
    it('should list feed ingredients', async () => {
      mockedService.listFeedIngredients.mockResolvedValue({
        data: [SAMPLE_INGREDIENT],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/org/feed-ingredients')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Silagem de Milho');
    });

    it('should filter by type', async () => {
      mockedService.listFeedIngredients.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await request(app)
        .get('/api/org/feed-ingredients?type=CONCENTRATE')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listFeedIngredients).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ type: 'CONCENTRATE' }),
      );
    });

    it('should search by name', async () => {
      mockedService.listFeedIngredients.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await request(app)
        .get('/api/org/feed-ingredients?search=silagem')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listFeedIngredients).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ search: 'silagem' }),
      );
    });
  });

  describe('GET /api/org/feed-ingredients/:id', () => {
    it('should return feed ingredient by id', async () => {
      mockedService.getFeedIngredient.mockResolvedValue(SAMPLE_INGREDIENT);

      const res = await request(app)
        .get('/api/org/feed-ingredients/fi-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('fi-1');
      expect(res.body.refDmPercent).toBe(33);
    });

    it('should return 404 for non-existent', async () => {
      mockedService.getFeedIngredient.mockRejectedValue(
        new FeedIngredientError('Alimento/ingrediente não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/feed-ingredients/xxx')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/org/feed-ingredients/:id', () => {
    it('should update feed ingredient', async () => {
      const updated = { ...SAMPLE_INGREDIENT, costPerKg: 0.42 };
      mockedService.updateFeedIngredient.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/org/feed-ingredients/fi-1')
        .set('Authorization', 'Bearer tok')
        .send({ costPerKg: 0.42 });

      expect(res.status).toBe(200);
      expect(res.body.costPerKg).toBe(0.42);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/org/feed-ingredients/:id', () => {
    it('should soft delete and return 204', async () => {
      mockedService.deleteFeedIngredient.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/feed-ingredients/fi-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 for non-existent', async () => {
      mockedService.deleteFeedIngredient.mockRejectedValue(
        new FeedIngredientError('Alimento/ingrediente não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/feed-ingredients/xxx')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/org/feed-ingredients/export', () => {
    it('should return CSV', async () => {
      mockedService.exportIngredientsCsv.mockResolvedValue(
        'Nome;Tipo\n"Silagem de Milho";Volumoso',
      );

      const res = await request(app)
        .get('/api/org/feed-ingredients/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Silagem de Milho');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BROMATOLOGICAL ANALYSES CRUD
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/org/bromatological-analyses', () => {
    const validInput = {
      feedIngredientId: 'fi-1',
      collectionDate: '2026-03-10',
      responsibleName: 'João Silva',
      dmPercent: 34.5,
      cpPercent: 7.8,
    };

    it('should create analysis and return 201', async () => {
      mockedService.createAnalysis.mockResolvedValue(SAMPLE_ANALYSIS);

      const res = await request(app)
        .post('/api/org/bromatological-analyses')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('ba-1');
      expect(res.body.feedIngredientName).toBe('Silagem de Milho');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing feed ingredient', async () => {
      mockedService.createAnalysis.mockRejectedValue(
        new FeedIngredientError('Alimento/ingrediente é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/bromatological-analyses')
        .set('Authorization', 'Bearer tok')
        .send({ collectionDate: '2026-03-10', responsibleName: 'João' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing collection date', async () => {
      mockedService.createAnalysis.mockRejectedValue(
        new FeedIngredientError('Data de coleta é obrigatória', 400),
      );

      const res = await request(app)
        .post('/api/org/bromatological-analyses')
        .set('Authorization', 'Bearer tok')
        .send({ feedIngredientId: 'fi-1', responsibleName: 'João' });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent feed ingredient', async () => {
      mockedService.createAnalysis.mockRejectedValue(
        new FeedIngredientError('Alimento/ingrediente não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/bromatological-analyses')
        .set('Authorization', 'Bearer tok')
        .send({ ...validInput, feedIngredientId: 'xxx' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/org/bromatological-analyses', () => {
    it('should list analyses', async () => {
      mockedService.listAnalyses.mockResolvedValue({
        data: [SAMPLE_ANALYSIS],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/org/bromatological-analyses')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by feedIngredientId', async () => {
      mockedService.listAnalyses.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await request(app)
        .get('/api/org/bromatological-analyses?feedIngredientId=fi-1')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listAnalyses).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ feedIngredientId: 'fi-1' }),
      );
    });
  });

  describe('GET /api/org/bromatological-analyses/:analysisId', () => {
    it('should return analysis by id', async () => {
      mockedService.getAnalysis.mockResolvedValue(SAMPLE_ANALYSIS);

      const res = await request(app)
        .get('/api/org/bromatological-analyses/ba-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('ba-1');
      expect(res.body.dmPercent).toBe(34.5);
    });

    it('should return 404 for non-existent', async () => {
      mockedService.getAnalysis.mockRejectedValue(
        new FeedIngredientError('Análise bromatológica não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/bromatological-analyses/xxx')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/org/bromatological-analyses/:analysisId', () => {
    it('should update analysis', async () => {
      const updated = { ...SAMPLE_ANALYSIS, dmPercent: 35.0 };
      mockedService.updateAnalysis.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/bromatological-analyses/ba-1')
        .set('Authorization', 'Bearer tok')
        .send({ dmPercent: 35.0 });

      expect(res.status).toBe(200);
      expect(res.body.dmPercent).toBe(35.0);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/org/bromatological-analyses/:analysisId', () => {
    it('should delete analysis', async () => {
      mockedService.deleteAnalysis.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/bromatological-analyses/ba-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('excluída com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  describe('GET /api/org/bromatological-analyses/export', () => {
    it('should return CSV', async () => {
      mockedService.exportAnalysesCsv.mockResolvedValue('Alimento;MS (%)\n"Silagem de Milho";34.5');

      const res = await request(app)
        .get('/api/org/bromatological-analyses/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CA4: Latest analysis
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/org/feed-ingredients/:id/latest-analysis', () => {
    it('should return latest analysis', async () => {
      mockedService.getLatestAnalysis.mockResolvedValue(SAMPLE_ANALYSIS);

      const res = await request(app)
        .get('/api/org/feed-ingredients/fi-1/latest-analysis')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('ba-1');
    });

    it('should return null when no analyses exist', async () => {
      mockedService.getLatestAnalysis.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/org/feed-ingredients/fi-1/latest-analysis')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CA5: Compare with reference
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/org/bromatological-analyses/:analysisId/compare', () => {
    it('should return comparison result', async () => {
      mockedService.compareWithReference.mockResolvedValue(SAMPLE_COMPARISON);

      const res = await request(app)
        .get('/api/org/bromatological-analyses/ba-1/compare')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.comparisons).toHaveLength(2);
      expect(res.body.comparisons[0].param).toBe('dmPercent');
      expect(res.body.comparisons[0].level).toBe('NORMAL');
    });

    it('should return 404 for non-existent analysis', async () => {
      mockedService.compareWithReference.mockRejectedValue(
        new FeedIngredientError('Análise bromatológica não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/bromatological-analyses/xxx/compare')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CA7: Quality trend
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/org/feed-ingredients/:id/quality-trend', () => {
    it('should return quality trend data', async () => {
      mockedService.getQualityTrend.mockResolvedValue(SAMPLE_TREND);

      const res = await request(app)
        .get('/api/org/feed-ingredients/fi-1/quality-trend')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.feedIngredientName).toBe('Silagem de Milho');
      expect(res.body.points).toHaveLength(1);
      expect(res.body.points[0].costPerKgDm).toBe(1.06);
      expect(res.body.points[0].costPerKgCp).toBe(14.14);
    });

    it('should return 404 for non-existent ingredient', async () => {
      mockedService.getQualityTrend.mockRejectedValue(
        new FeedIngredientError('Alimento/ingrediente não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/feed-ingredients/xxx/quality-trend')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CA6: Import CSV (multipart)
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/org/bromatological-analyses/import', () => {
    it('should import analyses from CSV', async () => {
      mockedService.importAnalysesCsv.mockResolvedValue(SAMPLE_IMPORT);

      const csvContent =
        'Alimento;Data Coleta;Responsavel;MS;PB\nSilagem de Milho;10/03/2026;João;34.5;7.8';

      const res = await request(app)
        .post('/api/org/bromatological-analyses/import')
        .set('Authorization', 'Bearer tok')
        .attach('file', Buffer.from(csvContent), 'analyses.csv');

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(5);
      expect(res.body.skipped).toBe(1);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing file', async () => {
      const res = await request(app)
        .post('/api/org/bromatological-analyses/import')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Arquivo');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CA3: Upload report
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/org/bromatological-analyses/:analysisId/report', () => {
    it('should upload report file', async () => {
      const updatedAnalysis = { ...SAMPLE_ANALYSIS, reportFileName: 'laudo.pdf' };
      mockedService.uploadAnalysisReport.mockResolvedValue(updatedAnalysis);

      const res = await request(app)
        .post('/api/org/bromatological-analyses/ba-1/report')
        .set('Authorization', 'Bearer tok')
        .attach('file', Buffer.from('%PDF-test'), 'laudo.pdf');

      expect(res.status).toBe(200);
      expect(res.body.reportFileName).toBe('laudo.pdf');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing file', async () => {
      const res = await request(app)
        .post('/api/org/bromatological-analyses/ba-1/report')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/org/bromatological-analyses/:analysisId/report', () => {
    it('should return report file', async () => {
      mockedService.getAnalysisReportFile.mockResolvedValue({
        buffer: Buffer.from('%PDF-test'),
        filename: 'laudo.pdf',
        mimetype: 'application/pdf',
      });

      const res = await request(app)
        .get('/api/org/bromatological-analyses/ba-1/report')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('should return 404 when no report exists', async () => {
      mockedService.getAnalysisReportFile.mockRejectedValue(
        new FeedIngredientError('Laudo não encontrado para esta análise', 404),
      );

      const res = await request(app)
        .get('/api/org/bromatological-analyses/ba-1/report')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Error handling
  // ═══════════════════════════════════════════════════════════════

  describe('Error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockedService.listFeedIngredients.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .get('/api/org/feed-ingredients')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const res = await request(app).get('/api/org/feed-ingredients');

      expect(res.status).toBe(401);
    });
  });
});
