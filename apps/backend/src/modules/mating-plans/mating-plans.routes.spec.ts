import request from 'supertest';
import { app } from '../../app';
import * as matingPlansService from './mating-plans.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  MatingPlanError,
  type MatingPlanItem,
  type MatingPlanDetail,
  type MatingPairItem,
  type AdherenceReport,
  type ImportPairsResult,
} from './mating-plans.types';

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

jest.mock('./mating-plans.service', () => ({
  createPlan: jest.fn(),
  listPlans: jest.fn(),
  getPlan: jest.fn(),
  updatePlan: jest.fn(),
  deletePlan: jest.fn(),
  addPairs: jest.fn(),
  updatePair: jest.fn(),
  removePair: jest.fn(),
  getAdherenceReport: jest.fn(),
  importPairsCsv: jest.fn(),
  exportPlanCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(matingPlansService);
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

const SAMPLE_PLAN: MatingPlanItem = {
  id: 'plan-1',
  organizationId: 'org-1',
  farmId: 'farm-1',
  name: 'Safra 2026/27',
  season: 'Safra 2026/27',
  objective: 'Aumentar produção de leite',
  status: 'DRAFT',
  statusLabel: 'Rascunho',
  startDate: '2026-06-01',
  endDate: '2026-12-31',
  notes: null,
  createdBy: 'admin-1',
  creatorName: 'Admin',
  pairsCount: 0,
  createdAt: '2026-03-14T10:00:00.000Z',
  updatedAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_PAIR: MatingPairItem = {
  id: 'pair-1',
  planId: 'plan-1',
  animalId: 'animal-1',
  animalEarTag: 'BR001',
  animalName: 'Mimosa',
  primaryBullId: 'bull-1',
  primaryBullName: 'Guardião FIV',
  secondaryBullId: 'bull-2',
  secondaryBullName: 'Imperador',
  tertiaryBullId: null,
  tertiaryBullName: null,
  status: 'PLANNED',
  statusLabel: 'Planejado',
  executedBullId: null,
  executedBullName: null,
  executionDate: null,
  substitutionReason: null,
  notes: null,
  createdAt: '2026-03-14T10:00:00.000Z',
  updatedAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_PLAN_DETAIL: MatingPlanDetail = {
  ...SAMPLE_PLAN,
  pairsCount: 1,
  pairs: [SAMPLE_PAIR],
};

describe('Mating Plans routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/mating-plans', () => {
    const validInput = {
      name: 'Safra 2026/27',
      season: 'Safra 2026/27',
      objective: 'Aumentar produção de leite',
      startDate: '2026-06-01',
      endDate: '2026-12-31',
    };

    it('should create plan and return 201', async () => {
      mockedService.createPlan.mockResolvedValue(SAMPLE_PLAN);

      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('plan-1');
      expect(res.body.name).toBe('Safra 2026/27');
      expect(mockedService.createPlan).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing name', async () => {
      mockedService.createPlan.mockRejectedValue(
        new MatingPlanError('Nome do plano é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans')
        .set('Authorization', 'Bearer tok')
        .send({ season: 'Safra 2026' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Nome do plano é obrigatório');
    });

    it('should deny OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST ────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/mating-plans', () => {
    it('should list plans with pagination', async () => {
      mockedService.listPlans.mockResolvedValue({
        data: [SAMPLE_PLAN],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/mating-plans')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockedService.listPlans.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/mating-plans?status=ACTIVE')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listPlans).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ status: 'ACTIVE' }),
      );
    });

    it('should filter by search', async () => {
      mockedService.listPlans.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/mating-plans?search=Safra')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listPlans).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ search: 'Safra' }),
      );
    });
  });

  // ─── GET ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/mating-plans/:planId', () => {
    it('should return plan with pairs', async () => {
      mockedService.getPlan.mockResolvedValue(SAMPLE_PLAN_DETAIL);

      const res = await request(app)
        .get('/api/org/farms/farm-1/mating-plans/plan-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('plan-1');
      expect(res.body.pairs).toHaveLength(1);
      expect(res.body.pairs[0].animalEarTag).toBe('BR001');
      expect(res.body.pairs[0].primaryBullName).toBe('Guardião FIV');
    });

    it('should return 404 when not found', async () => {
      mockedService.getPlan.mockRejectedValue(
        new MatingPlanError('Plano de acasalamento não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/mating-plans/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/mating-plans/:planId', () => {
    it('should update plan fields', async () => {
      const updated = { ...SAMPLE_PLAN, status: 'ACTIVE' as const, statusLabel: 'Ativo' };
      mockedService.updatePlan.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/mating-plans/plan-1')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.updatePlan.mockRejectedValue(
        new MatingPlanError('Plano de acasalamento não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/mating-plans/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/mating-plans/plan-1')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE ──────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/mating-plans/:planId', () => {
    it('should delete plan', async () => {
      mockedService.deletePlan.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/mating-plans/plan-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Plano de acasalamento excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deletePlan.mockRejectedValue(
        new MatingPlanError('Plano de acasalamento não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/mating-plans/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/mating-plans/plan-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── ADD PAIRS ───────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/mating-plans/:planId/pairs', () => {
    const validPairs = [
      {
        animalId: 'animal-1',
        primaryBullId: 'bull-1',
        secondaryBullId: 'bull-2',
      },
    ];

    it('should add pairs and return 201', async () => {
      mockedService.addPairs.mockResolvedValue([SAMPLE_PAIR]);

      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans/plan-1/pairs')
        .set('Authorization', 'Bearer tok')
        .send(validPairs);

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].animalEarTag).toBe('BR001');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when plan not found', async () => {
      mockedService.addPairs.mockRejectedValue(
        new MatingPlanError('Plano de acasalamento não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans/unknown/pairs')
        .set('Authorization', 'Bearer tok')
        .send(validPairs);

      expect(res.status).toBe(404);
    });

    it('should return 400 for empty pairs', async () => {
      mockedService.addPairs.mockRejectedValue(
        new MatingPlanError('Pelo menos um par deve ser informado', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans/plan-1/pairs')
        .set('Authorization', 'Bearer tok')
        .send([]);

      expect(res.status).toBe(400);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans/plan-1/pairs')
        .set('Authorization', 'Bearer tok')
        .send(validPairs);

      expect(res.status).toBe(403);
    });
  });

  // ─── UPDATE PAIR ─────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/mating-plans/pairs/:pairId', () => {
    it('should update pair status to EXECUTED', async () => {
      const updated: MatingPairItem = {
        ...SAMPLE_PAIR,
        status: 'EXECUTED',
        statusLabel: 'Executado',
        executedBullId: 'bull-1',
        executedBullName: 'Guardião FIV',
        executionDate: '2026-06-15',
      };
      mockedService.updatePair.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/mating-plans/pairs/pair-1')
        .set('Authorization', 'Bearer tok')
        .send({
          status: 'EXECUTED',
          executedBullId: 'bull-1',
          executionDate: '2026-06-15',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EXECUTED');
      expect(res.body.executedBullName).toBe('Guardião FIV');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should track substitution reason', async () => {
      const updated: MatingPairItem = {
        ...SAMPLE_PAIR,
        status: 'EXECUTED',
        statusLabel: 'Executado',
        executedBullId: 'bull-3',
        executedBullName: 'Outro Touro',
        executionDate: '2026-06-15',
        substitutionReason: 'Sêmen indisponível',
      };
      mockedService.updatePair.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/mating-plans/pairs/pair-1')
        .set('Authorization', 'Bearer tok')
        .send({
          status: 'EXECUTED',
          executedBullId: 'bull-3',
          executionDate: '2026-06-15',
          substitutionReason: 'Sêmen indisponível',
        });

      expect(res.status).toBe(200);
      expect(res.body.substitutionReason).toBe('Sêmen indisponível');
    });

    it('should return 404 when pair not found', async () => {
      mockedService.updatePair.mockRejectedValue(
        new MatingPlanError('Par de acasalamento não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/mating-plans/pairs/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'EXECUTED' });

      expect(res.status).toBe(404);
    });
  });

  // ─── REMOVE PAIR ─────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/mating-plans/pairs/:pairId', () => {
    it('should remove pair', async () => {
      mockedService.removePair.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/mating-plans/pairs/pair-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Par de acasalamento removido com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.removePair.mockRejectedValue(
        new MatingPlanError('Par de acasalamento não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/mating-plans/pairs/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── ADHERENCE REPORT (CA8) ──────────────────────────────────────

  describe('GET /api/org/farms/:farmId/mating-plans/:planId/adherence', () => {
    const SAMPLE_REPORT: AdherenceReport = {
      planId: 'plan-1',
      planName: 'Safra 2026/27',
      totalPairs: 10,
      executedPairs: 8,
      followedPlan: 6,
      substituted: 2,
      adherenceRate: 75,
      pending: 1,
      cancelled: 1,
      confirmedPregnant: 4,
      empty: 2,
    };

    it('should return adherence report', async () => {
      mockedService.getAdherenceReport.mockResolvedValue(SAMPLE_REPORT);

      const res = await request(app)
        .get('/api/org/farms/farm-1/mating-plans/plan-1/adherence')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalPairs).toBe(10);
      expect(res.body.adherenceRate).toBe(75);
      expect(res.body.followedPlan).toBe(6);
      expect(res.body.substituted).toBe(2);
    });

    it('should return 404 when plan not found', async () => {
      mockedService.getAdherenceReport.mockRejectedValue(
        new MatingPlanError('Plano de acasalamento não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/mating-plans/unknown/adherence')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── EXPORT CSV (CA10) ──────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/mating-plans/:planId/export', () => {
    it('should return CSV with correct headers', async () => {
      const csv =
        '\uFEFFBrinco;Nome Animal;Touro 1ª Opção;Touro 2ª Opção;Touro 3ª Opção;Status;Touro Executado;Data Execução;Motivo Substituição\nBR001;Mimosa;Guardião FIV;Imperador;;;Planejado;;;';
      mockedService.exportPlanCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/mating-plans/plan-1/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('plano-acasalamento.csv');
      expect(res.text).toContain('BR001');
      expect(res.text).toContain('Guardião FIV');
    });

    it('should return 404 when plan not found', async () => {
      mockedService.exportPlanCsv.mockRejectedValue(
        new MatingPlanError('Plano de acasalamento não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/mating-plans/unknown/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── IMPORT CSV (CA9) ───────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/mating-plans/:planId/import', () => {
    it('should import pairs from CSV', async () => {
      const importResult: ImportPairsResult = {
        imported: 3,
        skipped: 1,
        errors: ['Linha 5: Animal com brinco "XX999" não encontrado'],
      };
      mockedService.importPairsCsv.mockResolvedValue(importResult);

      const csvContent = 'brinco;touro_1;touro_2\nBR001;Guardião FIV;Imperador';
      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans/plan-1/import')
        .set('Authorization', 'Bearer tok')
        .attach('file', Buffer.from(csvContent), 'pares.csv');

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(3);
      expect(res.body.skipped).toBe(1);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 when no file provided', async () => {
      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans/plan-1/import')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Arquivo é obrigatório');
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/mating-plans/plan-1/import')
        .set('Authorization', 'Bearer tok')
        .attach('file', Buffer.from('test'), 'pares.csv');

      expect(res.status).toBe(403);
    });
  });

  // ─── AUTH ────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should return 401 without token', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).get('/api/org/farms/farm-1/mating-plans');

      expect(res.status).toBe(401);
    });
  });
});
