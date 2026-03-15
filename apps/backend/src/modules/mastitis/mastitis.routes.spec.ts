import request from 'supertest';
import { app } from '../../app';
import * as mastitisService from './mastitis.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  MastitisError,
  type MastitisCaseItem,
  type MastitisListItem,
  type ApplicationItem,
  type QuarterItem,
  type MastitisIndicators,
} from './mastitis.types';

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

jest.mock('./mastitis.service', () => ({
  createCase: jest.fn(),
  listCases: jest.fn(),
  getCase: jest.fn(),
  updateCase: jest.fn(),
  recordApplication: jest.fn(),
  updateQuarter: jest.fn(),
  closeCase: jest.fn(),
  deleteCase: jest.fn(),
  getAnimalMastitisHistory: jest.fn(),
  getMastitisIndicators: jest.fn(),
  exportMastitisCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(mastitisService);
const mockedAuth = jest.mocked(authService);
jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const CONSULTANT_PAYLOAD = {
  userId: 'consultant-1',
  email: 'consultant@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const SAMPLE_QUARTER: QuarterItem = {
  id: 'q-1',
  caseId: 'case-1',
  quarter: 'RL',
  quarterLabel: 'Posterior esquerdo',
  grade: 'GRADE_2_MODERATE',
  gradeLabel: 'Grau 2 — Moderada',
  milkAppearance: 'CLOTS',
  milkAppearanceLabel: 'Grumos',
  cmtResult: 'PLUS_2',
  cmtResultLabel: '++',
  status: 'IN_TREATMENT',
  statusLabel: 'Em tratamento',
  withdrawalEndDate: null,
  notes: null,
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_APPLICATION: ApplicationItem = {
  id: 'app-1',
  caseId: 'case-1',
  applicationDate: '2026-03-14',
  applicationTime: '08:00',
  productName: 'Ceftiofur',
  productId: 'prod-1',
  dose: '2.2 mg/kg',
  administrationRoute: 'INTRAMMARY',
  administrationRouteLabel: 'Intramamário',
  quarterTreated: 'RL',
  quarterTreatedLabel: 'Posterior esquerdo',
  responsibleName: 'João Silva',
  costCents: 1500,
  notes: null,
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_CASE: MastitisCaseItem = {
  id: 'case-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  occurrenceDate: '2026-03-14',
  occurrenceTime: '06:30',
  identifiedBy: 'João Silva',
  delAtOccurrence: 45,
  rectalTemperature: 40.2,
  temperatureAlert: true,
  classification: 'CLINICAL',
  classificationLabel: 'Clínica',
  status: 'OPEN',
  statusLabel: 'Aberto',
  cultureSampleCollected: true,
  cultureLab: 'Lab Vet Central',
  cultureSampleNumber: 'LAB-2026-001',
  cultureAgent: null,
  cultureAntibiogram: null,
  treatmentProtocolName: 'Mastite grau 2 — cefalosporina',
  withdrawalEndDate: null,
  closedAt: null,
  closureOutcome: null,
  closureOutcomeLabel: null,
  totalCostCents: 1500,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  quarters: [SAMPLE_QUARTER],
  applications: [SAMPLE_APPLICATION],
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_LIST_ITEM: MastitisListItem = {
  id: 'case-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  occurrenceDate: '2026-03-14',
  classification: 'CLINICAL',
  classificationLabel: 'Clínica',
  status: 'OPEN',
  statusLabel: 'Aberto',
  identifiedBy: 'João Silva',
  quartersAffected: ['RL'],
  treatmentProtocolName: 'Mastite grau 2 — cefalosporina',
  totalCostCents: 1500,
  createdAt: '2026-03-14T10:00:00.000Z',
};

const BASE_URL = '/api/org/farms/farm-1/mastitis';

describe('Mastitis routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1) ──────────────────────────────────────────────────

  describe('POST /org/farms/:farmId/mastitis', () => {
    const input = {
      animalId: 'animal-1',
      occurrenceDate: '2026-03-14',
      occurrenceTime: '06:30',
      identifiedBy: 'João Silva',
      rectalTemperature: 40.2,
      quarters: [
        { quarter: 'RL', grade: 'GRADE_2_MODERATE', milkAppearance: 'CLOTS', cmtResult: 'PLUS_2' },
      ],
      cultureSampleCollected: true,
      cultureLab: 'Lab Vet Central',
      cultureSampleNumber: 'LAB-2026-001',
      treatmentProtocolName: 'Mastite grau 2 — cefalosporina',
    };

    it('creates case and returns 201', async () => {
      mockedService.createCase.mockResolvedValue(SAMPLE_CASE);

      const res = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer token')
        .send(input);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('case-1');
      expect(res.body.classification).toBe('CLINICAL');
      expect(res.body.temperatureAlert).toBe(true);
      expect(res.body.quarters).toHaveLength(1);
    });

    it('returns 400 on validation error', async () => {
      mockedService.createCase.mockRejectedValue(new MastitisError('Animal é obrigatório', 400));

      const res = await request(app).post(BASE_URL).set('Authorization', 'Bearer token').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Animal é obrigatório');
    });

    it('returns 403 for consultant role (read-only)', async () => {
      authAs(CONSULTANT_PAYLOAD);

      const res = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer token')
        .send(input);

      expect(res.status).toBe(403);
    });

    it('logs audit on success', async () => {
      mockedService.createCase.mockResolvedValue(SAMPLE_CASE);

      await request(app).post(BASE_URL).set('Authorization', 'Bearer token').send(input);

      expect(auditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_MASTITIS_CASE',
          targetType: 'mastitis_case',
          targetId: 'case-1',
        }),
      );
    });
  });

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/mastitis', () => {
    it('returns list with pagination', async () => {
      mockedService.listCases.mockResolvedValue({
        data: [SAMPLE_LIST_ITEM],
        total: 1,
      });

      const res = await request(app)
        .get(BASE_URL)
        .set('Authorization', 'Bearer token')
        .query({ status: 'OPEN', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('passes filter params to service', async () => {
      mockedService.listCases.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get(BASE_URL)
        .set('Authorization', 'Bearer token')
        .query({ animalId: 'animal-1', classification: 'RECURRENT' });

      expect(mockedService.listCases).toHaveBeenCalledWith(
        expect.any(Object),
        'farm-1',
        expect.objectContaining({ animalId: 'animal-1', classification: 'RECURRENT' }),
      );
    });
  });

  // ─── GET ───────────────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/mastitis/:caseId', () => {
    it('returns case with quarters and applications', async () => {
      mockedService.getCase.mockResolvedValue(SAMPLE_CASE);

      const res = await request(app).get(`${BASE_URL}/case-1`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('case-1');
      expect(res.body.quarters).toHaveLength(1);
      expect(res.body.applications).toHaveLength(1);
    });

    it('returns 404 for missing case', async () => {
      mockedService.getCase.mockRejectedValue(
        new MastitisError('Caso de mastite não encontrado', 404),
      );

      const res = await request(app)
        .get(`${BASE_URL}/nonexistent`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────

  describe('PATCH /org/farms/:farmId/mastitis/:caseId', () => {
    it('updates case culture results', async () => {
      const updated = {
        ...SAMPLE_CASE,
        cultureAgent: 'Staphylococcus aureus',
      };
      mockedService.updateCase.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`${BASE_URL}/case-1`)
        .set('Authorization', 'Bearer token')
        .send({ cultureAgent: 'Staphylococcus aureus' });

      expect(res.status).toBe(200);
      expect(res.body.cultureAgent).toBe('Staphylococcus aureus');
    });

    it('returns 400 for closed case', async () => {
      mockedService.updateCase.mockRejectedValue(
        new MastitisError('Não é possível editar um caso encerrado', 400),
      );

      const res = await request(app)
        .patch(`${BASE_URL}/case-1`)
        .set('Authorization', 'Bearer token')
        .send({ notes: 'test' });

      expect(res.status).toBe(400);
    });
  });

  // ─── CLOSE (CA9) ──────────────────────────────────────────────────

  describe('PATCH /org/farms/:farmId/mastitis/:caseId/close', () => {
    it('closes case with outcome', async () => {
      const closed: MastitisCaseItem = {
        ...SAMPLE_CASE,
        status: 'CLOSED',
        statusLabel: 'Encerrado',
        closureOutcome: 'CURED',
        closureOutcomeLabel: 'Curado',
        closedAt: '2026-03-20T10:00:00.000Z',
      };
      mockedService.closeCase.mockResolvedValue(closed);

      const res = await request(app)
        .patch(`${BASE_URL}/case-1/close`)
        .set('Authorization', 'Bearer token')
        .send({ closureOutcome: 'CURED', notes: 'Animal recuperado' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CLOSED');
      expect(res.body.closureOutcome).toBe('CURED');
    });

    it('logs audit on close', async () => {
      const closed: MastitisCaseItem = {
        ...SAMPLE_CASE,
        status: 'CLOSED',
        closureOutcome: 'CURED',
      };
      mockedService.closeCase.mockResolvedValue(closed);

      await request(app)
        .patch(`${BASE_URL}/case-1/close`)
        .set('Authorization', 'Bearer token')
        .send({ closureOutcome: 'CURED' });

      expect(auditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CLOSE_MASTITIS_CASE',
          metadata: expect.objectContaining({ closureOutcome: 'CURED' }),
        }),
      );
    });
  });

  // ─── DELETE ──────────────────────────────────────────────────────

  describe('DELETE /org/farms/:farmId/mastitis/:caseId', () => {
    it('deletes case and returns success message', async () => {
      mockedService.deleteCase.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`${BASE_URL}/case-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Caso de mastite excluído com sucesso');
    });

    it('returns 404 for missing case', async () => {
      mockedService.deleteCase.mockRejectedValue(
        new MastitisError('Caso de mastite não encontrado', 404),
      );

      const res = await request(app)
        .delete(`${BASE_URL}/nonexistent`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── RECORD APPLICATION (CA6) ────────────────────────────────────

  describe('POST /org/farms/:farmId/mastitis/:caseId/applications', () => {
    const appInput = {
      applicationDate: '2026-03-14',
      applicationTime: '08:00',
      productName: 'Ceftiofur',
      productId: 'prod-1',
      dose: '2.2 mg/kg',
      administrationRoute: 'INTRAMMARY',
      quarterTreated: 'RL',
      responsibleName: 'João Silva',
      costCents: 1500,
    };

    it('records application and returns 201', async () => {
      mockedService.recordApplication.mockResolvedValue(SAMPLE_APPLICATION);

      const res = await request(app)
        .post(`${BASE_URL}/case-1/applications`)
        .set('Authorization', 'Bearer token')
        .send(appInput);

      expect(res.status).toBe(201);
      expect(res.body.productName).toBe('Ceftiofur');
      expect(res.body.administrationRoute).toBe('INTRAMMARY');
    });

    it('returns 400 on missing product name', async () => {
      mockedService.recordApplication.mockRejectedValue(
        new MastitisError('Nome do produto é obrigatório', 400),
      );

      const res = await request(app)
        .post(`${BASE_URL}/case-1/applications`)
        .set('Authorization', 'Bearer token')
        .send({ applicationDate: '2026-03-14' });

      expect(res.status).toBe(400);
    });

    it('logs audit on application', async () => {
      mockedService.recordApplication.mockResolvedValue(SAMPLE_APPLICATION);

      await request(app)
        .post(`${BASE_URL}/case-1/applications`)
        .set('Authorization', 'Bearer token')
        .send(appInput);

      expect(auditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RECORD_MASTITIS_APPLICATION',
          targetType: 'mastitis_application',
        }),
      );
    });
  });

  // ─── UPDATE QUARTER (CA8) ────────────────────────────────────────

  describe('PATCH /org/farms/:farmId/mastitis/:caseId/quarters/:quarterId', () => {
    it('updates quarter status', async () => {
      const updated: QuarterItem = {
        ...SAMPLE_QUARTER,
        status: 'CURED',
        statusLabel: 'Curado',
      };
      mockedService.updateQuarter.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`${BASE_URL}/case-1/quarters/q-1`)
        .set('Authorization', 'Bearer token')
        .send({ status: 'CURED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CURED');
    });

    it('updates quarter milk appearance and CMT', async () => {
      const updated: QuarterItem = {
        ...SAMPLE_QUARTER,
        milkAppearance: 'NORMAL',
        milkAppearanceLabel: 'Normal',
        cmtResult: 'NEGATIVE',
        cmtResultLabel: 'Negativo',
      };
      mockedService.updateQuarter.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`${BASE_URL}/case-1/quarters/q-1`)
        .set('Authorization', 'Bearer token')
        .send({ milkAppearance: 'NORMAL', cmtResult: 'NEGATIVE' });

      expect(res.status).toBe(200);
      expect(res.body.milkAppearance).toBe('NORMAL');
      expect(res.body.cmtResult).toBe('NEGATIVE');
    });

    it('returns 404 for missing quarter', async () => {
      mockedService.updateQuarter.mockRejectedValue(
        new MastitisError('Quarto não encontrado', 404),
      );

      const res = await request(app)
        .patch(`${BASE_URL}/case-1/quarters/nonexistent`)
        .set('Authorization', 'Bearer token')
        .send({ status: 'CURED' });

      expect(res.status).toBe(404);
    });

    it('logs audit on quarter update', async () => {
      mockedService.updateQuarter.mockResolvedValue(SAMPLE_QUARTER);

      await request(app)
        .patch(`${BASE_URL}/case-1/quarters/q-1`)
        .set('Authorization', 'Bearer token')
        .send({ status: 'IN_WITHDRAWAL' });

      expect(auditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_MASTITIS_QUARTER',
          targetType: 'mastitis_quarter',
        }),
      );
    });
  });

  // ─── ANIMAL HISTORY (CA10) ───────────────────────────────────────

  describe('GET /org/farms/:farmId/mastitis/animal/:animalId/history', () => {
    it('returns all mastitis episodes for animal', async () => {
      mockedService.getAnimalMastitisHistory.mockResolvedValue([SAMPLE_CASE]);

      const res = await request(app)
        .get(`${BASE_URL}/animal/animal-1/history`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('case-1');
    });

    it('returns 404 for missing animal', async () => {
      mockedService.getAnimalMastitisHistory.mockRejectedValue(
        new MastitisError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .get(`${BASE_URL}/animal/nonexistent/history`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── INDICATORS (CA11) ──────────────────────────────────────────

  describe('GET /org/farms/:farmId/mastitis/indicators', () => {
    const indicators: MastitisIndicators = {
      totalCases: 20,
      openCases: 5,
      closedCases: 15,
      clinicalRate: 0.6,
      subclinicalRate: 0.2,
      recurrentRate: 0.15,
      chronicRate: 0.05,
      quarterBreakdown: { FL: 3, FR: 5, RL: 8, RR: 4 },
      topAgents: [
        { agent: 'Staphylococcus aureus', count: 7 },
        { agent: 'E. coli', count: 4 },
      ],
      cureRate: 0.8,
      totalCostCents: 250000,
      recurrentCows: 3,
    };

    it('returns herd mastitis indicators', async () => {
      mockedService.getMastitisIndicators.mockResolvedValue(indicators);

      const res = await request(app)
        .get(`${BASE_URL}/indicators`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.totalCases).toBe(20);
      expect(res.body.cureRate).toBe(0.8);
      expect(res.body.topAgents).toHaveLength(2);
      expect(res.body.quarterBreakdown.RL).toBe(8);
      expect(res.body.recurrentCows).toBe(3);
    });
  });

  // ─── EXPORT CSV ──────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/mastitis/export', () => {
    it('returns CSV file', async () => {
      mockedService.exportMastitisCsv.mockResolvedValue(
        '\uFEFFBrinco;Data Ocorrência\n001;14/03/2026',
      );

      const res = await request(app).get(`${BASE_URL}/export`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('mastite.csv');
    });
  });
});
