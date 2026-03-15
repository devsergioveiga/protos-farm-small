import request from 'supertest';
import { app } from '../../app';
import * as treatmentsService from './therapeutic-treatments.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  TherapeuticTreatmentError,
  type TreatmentItem,
  type TreatmentListItem,
  type ApplicationItem,
  type EvolutionItem,
  type PendingApplicationsResult,
} from './therapeutic-treatments.types';

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

jest.mock('./therapeutic-treatments.service', () => ({
  createTreatment: jest.fn(),
  listTreatments: jest.fn(),
  getTreatment: jest.fn(),
  updateTreatment: jest.fn(),
  closeTreatment: jest.fn(),
  deleteTreatment: jest.fn(),
  recordApplication: jest.fn(),
  skipApplication: jest.fn(),
  recordEvolution: jest.fn(),
  getPendingApplications: jest.fn(),
  exportTreatmentsCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(treatmentsService);
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

const SAMPLE_APPLICATION: ApplicationItem = {
  id: 'app-1',
  treatmentId: 'treat-1',
  productId: 'prod-1',
  productName: 'Ceftiofur',
  dosage: 2.2,
  dosageUnit: 'MG_KG',
  dosageUnitLabel: 'mg/kg',
  administrationRoute: 'IM',
  administrationRouteLabel: 'Intramuscular',
  scheduledDate: '2026-03-14',
  scheduledTime: '08:00',
  applicationDate: null,
  applicationTime: null,
  status: 'PENDING',
  statusLabel: 'Pendente',
  notDoneReason: null,
  responsibleName: null,
  stockOutputId: null,
  costCents: 0,
  notes: null,
};

const SAMPLE_EVOLUTION: EvolutionItem = {
  id: 'evo-1',
  treatmentId: 'treat-1',
  evolutionDate: '2026-03-15',
  evolutionType: 'IMPROVEMENT',
  evolutionTypeLabel: 'Melhora',
  temperature: 38.5,
  observations: 'Animal se alimentando normalmente',
  veterinaryName: 'Dr. Carlos',
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-15T10:00:00.000Z',
};

const SAMPLE_TREATMENT: TreatmentItem = {
  id: 'treat-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  diseaseId: 'disease-1',
  diseaseName: 'Mastite clínica',
  diagnosisDate: '2026-03-14',
  observedSeverity: 'MODERATE',
  severityLabel: 'Moderada',
  clinicalObservations: 'Quarto posterior esquerdo inflamado',
  veterinaryName: 'Dr. Carlos',
  responsibleName: 'João Silva',
  treatmentProtocolId: 'protocol-1',
  treatmentProtocolName: 'Mastite clínica grau 2 — sistêmica',
  withdrawalMeatDays: 8,
  withdrawalMilkDays: 96,
  withdrawalEndDate: '2026-03-27',
  status: 'OPEN',
  statusLabel: 'Aberto',
  outcome: null,
  outcomeLabel: null,
  closedAt: null,
  closingNotes: null,
  totalCostCents: 0,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  applications: [SAMPLE_APPLICATION],
  evolutions: [],
  pendingApplicationsToday: 1,
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_LIST_ITEM: TreatmentListItem = {
  id: 'treat-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  diseaseName: 'Mastite clínica',
  diagnosisDate: '2026-03-14',
  observedSeverity: 'MODERATE',
  severityLabel: 'Moderada',
  status: 'OPEN',
  statusLabel: 'Aberto',
  outcome: null,
  outcomeLabel: null,
  veterinaryName: 'Dr. Carlos',
  treatmentProtocolName: 'Mastite clínica grau 2',
  totalCostCents: 0,
  createdAt: '2026-03-14T10:00:00.000Z',
};

const BASE_URL = '/api/org/farms/farm-1/therapeutic-treatments';

describe('Therapeutic treatments routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1) ──────────────────────────────────────────────────

  describe('POST /org/farms/:farmId/therapeutic-treatments', () => {
    const input = {
      animalId: 'animal-1',
      diseaseId: 'disease-1',
      diseaseName: 'Mastite clínica',
      diagnosisDate: '2026-03-14',
      observedSeverity: 'MODERATE',
      clinicalObservations: 'Quarto posterior esquerdo inflamado',
      veterinaryName: 'Dr. Carlos',
      responsibleName: 'João Silva',
      treatmentProtocolId: 'protocol-1',
    };

    it('creates treatment and returns 201', async () => {
      mockedService.createTreatment.mockResolvedValue(SAMPLE_TREATMENT);

      const res = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer token')
        .send(input);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('treat-1');
      expect(res.body.diseaseName).toBe('Mastite clínica');
      expect(res.body.status).toBe('OPEN');
      expect(res.body.applications).toHaveLength(1);
    });

    it('returns 400 on validation error', async () => {
      mockedService.createTreatment.mockRejectedValue(
        new TherapeuticTreatmentError('Animal é obrigatório', 400),
      );

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
      mockedService.createTreatment.mockResolvedValue(SAMPLE_TREATMENT);

      await request(app).post(BASE_URL).set('Authorization', 'Bearer token').send(input);

      expect(auditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_THERAPEUTIC_TREATMENT',
          targetType: 'therapeutic_treatment',
          targetId: 'treat-1',
        }),
      );
    });
  });

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/therapeutic-treatments', () => {
    it('returns list with pagination', async () => {
      mockedService.listTreatments.mockResolvedValue({
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
      mockedService.listTreatments.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get(BASE_URL)
        .set('Authorization', 'Bearer token')
        .query({ animalId: 'animal-1', status: 'IN_PROGRESS' });

      expect(mockedService.listTreatments).toHaveBeenCalledWith(
        expect.any(Object),
        'farm-1',
        expect.objectContaining({ animalId: 'animal-1', status: 'IN_PROGRESS' }),
      );
    });
  });

  // ─── GET ───────────────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/therapeutic-treatments/:treatmentId', () => {
    it('returns treatment with applications and evolutions', async () => {
      mockedService.getTreatment.mockResolvedValue(SAMPLE_TREATMENT);

      const res = await request(app)
        .get(`${BASE_URL}/treat-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('treat-1');
      expect(res.body.applications).toHaveLength(1);
      expect(res.body.pendingApplicationsToday).toBe(1);
    });

    it('returns 404 for missing treatment', async () => {
      mockedService.getTreatment.mockRejectedValue(
        new TherapeuticTreatmentError('Tratamento não encontrado', 404),
      );

      const res = await request(app)
        .get(`${BASE_URL}/nonexistent`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────

  describe('PATCH /org/farms/:farmId/therapeutic-treatments/:treatmentId', () => {
    it('updates treatment', async () => {
      const updated = { ...SAMPLE_TREATMENT, clinicalObservations: 'Melhorando' };
      mockedService.updateTreatment.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`${BASE_URL}/treat-1`)
        .set('Authorization', 'Bearer token')
        .send({ clinicalObservations: 'Melhorando' });

      expect(res.status).toBe(200);
      expect(res.body.clinicalObservations).toBe('Melhorando');
    });

    it('returns 400 for closed treatment', async () => {
      mockedService.updateTreatment.mockRejectedValue(
        new TherapeuticTreatmentError('Não é possível editar um tratamento encerrado', 400),
      );

      const res = await request(app)
        .patch(`${BASE_URL}/treat-1`)
        .set('Authorization', 'Bearer token')
        .send({ notes: 'test' });

      expect(res.status).toBe(400);
    });
  });

  // ─── CLOSE (CA8) ─────────────────────────────────────────────────

  describe('PATCH /org/farms/:farmId/therapeutic-treatments/:treatmentId/close', () => {
    it('closes treatment with outcome', async () => {
      const closed: TreatmentItem = {
        ...SAMPLE_TREATMENT,
        status: 'CLOSED',
        statusLabel: 'Encerrado',
        outcome: 'CURED',
        outcomeLabel: 'Curado',
        closedAt: '2026-03-20T10:00:00.000Z',
      };
      mockedService.closeTreatment.mockResolvedValue(closed);

      const res = await request(app)
        .patch(`${BASE_URL}/treat-1/close`)
        .set('Authorization', 'Bearer token')
        .send({ outcome: 'CURED', closingNotes: 'Animal recuperado' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CLOSED');
      expect(res.body.outcome).toBe('CURED');
    });

    it('logs audit on close', async () => {
      const closed: TreatmentItem = {
        ...SAMPLE_TREATMENT,
        status: 'CLOSED',
        outcome: 'CURED',
      };
      mockedService.closeTreatment.mockResolvedValue(closed);

      await request(app)
        .patch(`${BASE_URL}/treat-1/close`)
        .set('Authorization', 'Bearer token')
        .send({ outcome: 'CURED' });

      expect(auditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CLOSE_THERAPEUTIC_TREATMENT',
          metadata: expect.objectContaining({ outcome: 'CURED' }),
        }),
      );
    });
  });

  // ─── DELETE ─────────────────────────────────────────────────────────

  describe('DELETE /org/farms/:farmId/therapeutic-treatments/:treatmentId', () => {
    it('deletes treatment and returns success message', async () => {
      mockedService.deleteTreatment.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`${BASE_URL}/treat-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Tratamento excluído com sucesso');
    });

    it('returns 404 for missing treatment', async () => {
      mockedService.deleteTreatment.mockRejectedValue(
        new TherapeuticTreatmentError('Tratamento não encontrado', 404),
      );

      const res = await request(app)
        .delete(`${BASE_URL}/nonexistent`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── RECORD APPLICATION (CA4) ────────────────────────────────────

  describe('PATCH .../applications/:applicationId/done', () => {
    it('records application as done', async () => {
      const done: ApplicationItem = {
        ...SAMPLE_APPLICATION,
        status: 'DONE',
        statusLabel: 'Realizado',
        applicationDate: '2026-03-14',
        applicationTime: '08:30',
        responsibleName: 'João Silva',
      };
      mockedService.recordApplication.mockResolvedValue(done);

      const res = await request(app)
        .patch(`${BASE_URL}/treat-1/applications/app-1/done`)
        .set('Authorization', 'Bearer token')
        .send({
          applicationDate: '2026-03-14',
          applicationTime: '08:30',
          responsibleName: 'João Silva',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DONE');
    });

    it('logs audit on application', async () => {
      const done: ApplicationItem = { ...SAMPLE_APPLICATION, status: 'DONE' };
      mockedService.recordApplication.mockResolvedValue(done);

      await request(app)
        .patch(`${BASE_URL}/treat-1/applications/app-1/done`)
        .set('Authorization', 'Bearer token')
        .send({ applicationDate: '2026-03-14', responsibleName: 'João' });

      expect(auditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RECORD_TREATMENT_APPLICATION',
          targetType: 'treatment_application',
        }),
      );
    });
  });

  // ─── SKIP APPLICATION (CA4) ──────────────────────────────────────

  describe('PATCH .../applications/:applicationId/skip', () => {
    it('marks application as not done with reason', async () => {
      const skipped: ApplicationItem = {
        ...SAMPLE_APPLICATION,
        status: 'NOT_DONE',
        statusLabel: 'Não realizado',
        notDoneReason: 'Animal agitado',
      };
      mockedService.skipApplication.mockResolvedValue(skipped);

      const res = await request(app)
        .patch(`${BASE_URL}/treat-1/applications/app-1/skip`)
        .set('Authorization', 'Bearer token')
        .send({ notDoneReason: 'Animal agitado' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('NOT_DONE');
      expect(res.body.notDoneReason).toBe('Animal agitado');
    });
  });

  // ─── RECORD EVOLUTION (CA5) ──────────────────────────────────────

  describe('POST .../therapeutic-treatments/:treatmentId/evolutions', () => {
    it('records clinical evolution', async () => {
      mockedService.recordEvolution.mockResolvedValue(SAMPLE_EVOLUTION);

      const res = await request(app)
        .post(`${BASE_URL}/treat-1/evolutions`)
        .set('Authorization', 'Bearer token')
        .send({
          evolutionDate: '2026-03-15',
          evolutionType: 'IMPROVEMENT',
          temperature: 38.5,
          observations: 'Animal se alimentando normalmente',
          veterinaryName: 'Dr. Carlos',
        });

      expect(res.status).toBe(201);
      expect(res.body.evolutionType).toBe('IMPROVEMENT');
      expect(res.body.temperature).toBe(38.5);
    });

    it('logs audit on evolution', async () => {
      mockedService.recordEvolution.mockResolvedValue(SAMPLE_EVOLUTION);

      await request(app)
        .post(`${BASE_URL}/treat-1/evolutions`)
        .set('Authorization', 'Bearer token')
        .send({ evolutionDate: '2026-03-15', evolutionType: 'IMPROVEMENT' });

      expect(auditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RECORD_CLINICAL_EVOLUTION',
          targetType: 'clinical_evolution',
        }),
      );
    });
  });

  // ─── PENDING APPLICATIONS (CA4) ─────────────────────────────────

  describe('GET .../therapeutic-treatments/pending-applications', () => {
    it('returns pending applications for today', async () => {
      const result: PendingApplicationsResult = {
        date: '2026-03-14',
        totalPending: 2,
        treatments: [
          {
            treatmentId: 'treat-1',
            animalEarTag: '001',
            animalName: 'Mimosa',
            diseaseName: 'Mastite clínica',
            applications: [SAMPLE_APPLICATION],
          },
        ],
      };
      mockedService.getPendingApplications.mockResolvedValue(result);

      const res = await request(app)
        .get(`${BASE_URL}/pending-applications`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.totalPending).toBe(2);
      expect(res.body.treatments).toHaveLength(1);
    });

    it('accepts date query param', async () => {
      mockedService.getPendingApplications.mockResolvedValue({
        date: '2026-03-15',
        totalPending: 0,
        treatments: [],
      });

      await request(app)
        .get(`${BASE_URL}/pending-applications`)
        .set('Authorization', 'Bearer token')
        .query({ date: '2026-03-15' });

      expect(mockedService.getPendingApplications).toHaveBeenCalledWith(
        expect.any(Object),
        'farm-1',
        '2026-03-15',
      );
    });
  });

  // ─── EXPORT CSV ──────────────────────────────────────────────────

  describe('GET .../therapeutic-treatments/export', () => {
    it('returns CSV file', async () => {
      mockedService.exportTreatmentsCsv.mockResolvedValue('\uFEFFBrinco;Doença\n001;Mastite');

      const res = await request(app).get(`${BASE_URL}/export`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('tratamentos-terapeuticos.csv');
    });
  });
});
