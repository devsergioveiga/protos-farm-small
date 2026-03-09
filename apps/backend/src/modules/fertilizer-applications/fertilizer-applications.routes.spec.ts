import request from 'supertest';
import { app } from '../../app';
import * as fertilizerService from './fertilizer-applications.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { FertilizerApplicationError } from './fertilizer-applications.types';

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

jest.mock('./fertilizer-applications.service', () => ({
  createFertilizerApplication: jest.fn(),
  listFertilizerApplications: jest.fn(),
  getFertilizerApplication: jest.fn(),
  updateFertilizerApplication: jest.fn(),
  deleteFertilizerApplication: jest.fn(),
  getNutrientSummary: jest.fn(),
  getApplicationsReport: jest.fn(),
  applicationsToCsv: jest.fn(),
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

const mockedService = jest.mocked(fertilizerService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const FARM_ID = 'farm-1';
const APP_ID = 'fert-1';

const SAMPLE_APPLICATION = {
  id: APP_ID,
  farmId: FARM_ID,
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão Norte',
  appliedAt: '2026-03-08T10:00:00.000Z',
  applicationType: 'COBERTURA_LANCO',
  productName: 'Ureia',
  formulation: '45-00-00',
  dose: 200,
  doseUnit: 'KG_HA',
  nutrientSource: 'Ureia',
  phenologicalStage: 'V4',
  nitrogenN: 90,
  phosphorusP: null,
  potassiumK: null,
  machineName: 'Distribuidor centrífugo',
  operatorName: 'João Silva',
  areaAppliedHa: 15.5,
  plantsPerHa: null,
  dosePerPlantG: null,
  notes: null,
  photoUrl: null,
  latitude: null,
  longitude: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin User',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const BASE_URL = `/api/org/farms/${FARM_ID}/fertilizer-applications`;

describe('Fertilizer Application endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get(BASE_URL);
      expect(response.status).toBe(401);
    });

    it('should return 403 for OPERATOR trying to create', async () => {
      authAs(OPERATOR_PAYLOAD);
      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({});
      expect(response.status).toBe(403);
    });

    it('should allow ADMIN to list', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listFertilizerApplications.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
      const response = await request(app).get(BASE_URL).set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(200);
    });
  });

  // ─── POST ─────────────────────────────────────────────────────────

  describe('POST /org/farms/:farmId/fertilizer-applications', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should create application and return 201', async () => {
      mockedService.createFertilizerApplication.mockResolvedValue(SAMPLE_APPLICATION as never);

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          appliedAt: '2026-03-08T10:00:00.000Z',
          applicationType: 'COBERTURA_LANCO',
          productName: 'Ureia',
          dose: 200,
          doseUnit: 'KG_HA',
        });

      expect(response.status).toBe(201);
      expect(response.body.productName).toBe('Ureia');
      expect(response.body.applicationType).toBe('COBERTURA_LANCO');
      expect(response.body.dose).toBe(200);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_FERTILIZER_APPLICATION' }),
      );
    });

    it('should return 400 when service throws FertilizerApplicationError(400)', async () => {
      mockedService.createFertilizerApplication.mockRejectedValue(
        new FertilizerApplicationError('Dose deve ser maior que zero', 400),
      );

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Dose deve ser maior que zero');
    });

    it('should return 404 when plot not found', async () => {
      mockedService.createFertilizerApplication.mockRejectedValue(
        new FertilizerApplicationError('Talhão não encontrado nesta fazenda', 404),
      );

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({ fieldPlotId: 'invalid' });

      expect(response.status).toBe(404);
    });

    it('should create application with nutrient data (N/P/K)', async () => {
      const withNutrients = {
        ...SAMPLE_APPLICATION,
        nitrogenN: 90,
        phosphorusP: 40,
        potassiumK: 60,
      };
      mockedService.createFertilizerApplication.mockResolvedValue(withNutrients as never);

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          appliedAt: '2026-03-08T10:00:00.000Z',
          applicationType: 'COBERTURA_SOLIDA',
          productName: 'NPK 04-14-08',
          dose: 400,
          nitrogenN: 90,
          phosphorusP: 40,
          potassiumK: 60,
        });

      expect(response.status).toBe(201);
      expect(response.body.nitrogenN).toBe(90);
      expect(response.body.phosphorusP).toBe(40);
      expect(response.body.potassiumK).toBe(60);
    });

    it('should create application with equipment data', async () => {
      const withEquipment = {
        ...SAMPLE_APPLICATION,
        machineName: 'Distribuidor centrífugo',
        operatorName: 'João Silva',
        areaAppliedHa: 15.5,
      };
      mockedService.createFertilizerApplication.mockResolvedValue(withEquipment as never);

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          appliedAt: '2026-03-08T10:00:00.000Z',
          applicationType: 'COBERTURA_LANCO',
          productName: 'Ureia',
          dose: 200,
          machineName: 'Distribuidor centrífugo',
          operatorName: 'João Silva',
          areaAppliedHa: 15.5,
        });

      expect(response.status).toBe(201);
      expect(response.body.machineName).toBe('Distribuidor centrífugo');
      expect(response.body.operatorName).toBe('João Silva');
      expect(response.body.areaAppliedHa).toBe(15.5);
    });

    it('should create foliar application with dose per plant', async () => {
      const foliar = {
        ...SAMPLE_APPLICATION,
        applicationType: 'FOLIAR',
        doseUnit: 'G_PLANTA',
        plantsPerHa: 3333,
        dosePerPlantG: 50,
      };
      mockedService.createFertilizerApplication.mockResolvedValue(foliar as never);

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          appliedAt: '2026-03-08T10:00:00.000Z',
          applicationType: 'FOLIAR',
          productName: 'Sulfato de Zinco',
          dose: 50,
          doseUnit: 'G_PLANTA',
          plantsPerHa: 3333,
          dosePerPlantG: 50,
        });

      expect(response.status).toBe(201);
      expect(response.body.applicationType).toBe('FOLIAR');
      expect(response.body.plantsPerHa).toBe(3333);
      expect(response.body.dosePerPlantG).toBe(50);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.createFertilizerApplication.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── GET list ─────────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/fertilizer-applications', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should list with pagination and filters', async () => {
      mockedService.listFertilizerApplications.mockResolvedValue({
        data: [SAMPLE_APPLICATION as never],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const response = await request(app)
        .get(`${BASE_URL}?page=1&applicationType=FOLIAR&search=Ureia`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.total).toBe(1);
    });

    it('should pass date filters', async () => {
      mockedService.listFertilizerApplications.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get(`${BASE_URL}?dateFrom=2026-03-01&dateTo=2026-03-31`)
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listFertilizerApplications).toHaveBeenCalledWith(
        expect.any(Object),
        FARM_ID,
        expect.objectContaining({
          dateFrom: '2026-03-01',
          dateTo: '2026-03-31',
        }),
      );
    });
  });

  // ─── GET single ───────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/fertilizer-applications/:applicationId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return single application', async () => {
      mockedService.getFertilizerApplication.mockResolvedValue(SAMPLE_APPLICATION as never);

      const response = await request(app)
        .get(`${BASE_URL}/${APP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(APP_ID);
    });

    it('should return 404 for non-existing application', async () => {
      mockedService.getFertilizerApplication.mockRejectedValue(
        new FertilizerApplicationError('Aplicação não encontrada', 404),
      );

      const response = await request(app)
        .get(`${BASE_URL}/non-existing`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH ────────────────────────────────────────────────────────

  describe('PATCH /org/farms/:farmId/fertilizer-applications/:applicationId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should update application', async () => {
      const updated = { ...SAMPLE_APPLICATION, dose: 250 };
      mockedService.updateFertilizerApplication.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch(`${BASE_URL}/${APP_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ dose: 250 });

      expect(response.status).toBe(200);
      expect(response.body.dose).toBe(250);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_FERTILIZER_APPLICATION' }),
      );
    });
  });

  // ─── NUTRIENT SUMMARY ──────────────────────────────────────────────

  describe('GET /org/farms/:farmId/fertilizer-applications/nutrient-summary', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return nutrient summary by plot', async () => {
      const summary = [
        {
          fieldPlotId: 'plot-1',
          fieldPlotName: 'Talhão Norte',
          totalN: 180,
          totalP: 80,
          totalK: 120,
          applicationCount: 3,
        },
      ];
      mockedService.getNutrientSummary.mockResolvedValue(summary);

      const response = await request(app)
        .get(`${BASE_URL}/nutrient-summary?seasonYear=2025/2026`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].totalN).toBe(180);
      expect(response.body[0].totalP).toBe(80);
      expect(response.body[0].totalK).toBe(120);
      expect(response.body[0].applicationCount).toBe(3);
    });

    it('should return empty array when no applications', async () => {
      mockedService.getNutrientSummary.mockResolvedValue([]);

      const response = await request(app)
        .get(`${BASE_URL}/nutrient-summary`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });

  // ─── REPORT EXPORT ─────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/fertilizer-applications/report/export', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return CSV with correct headers', async () => {
      mockedService.getApplicationsReport.mockResolvedValue([SAMPLE_APPLICATION as never]);
      mockedService.applicationsToCsv.mockReturnValue('Data/Hora,Talhão\n2026-03-08,Talhão Norte');

      const response = await request(app)
        .get(`${BASE_URL}/report/export`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('aplicacoes-adubacao.csv');
    });

    it('should pass filters to report service', async () => {
      mockedService.getApplicationsReport.mockResolvedValue([]);
      mockedService.applicationsToCsv.mockReturnValue('Data/Hora,Talhão');

      await request(app)
        .get(
          `${BASE_URL}/report/export?dateFrom=2026-03-01&dateTo=2026-03-31&fieldPlotId=plot-1&applicationType=FOLIAR`,
        )
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.getApplicationsReport).toHaveBeenCalledWith(
        expect.any(Object),
        FARM_ID,
        expect.objectContaining({
          dateFrom: '2026-03-01',
          dateTo: '2026-03-31',
          fieldPlotId: 'plot-1',
          applicationType: 'FOLIAR',
        }),
      );
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /org/farms/:farmId/fertilizer-applications/:applicationId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should soft delete and return 204', async () => {
      mockedService.deleteFertilizerApplication.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`${BASE_URL}/${APP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_FERTILIZER_APPLICATION' }),
      );
    });

    it('should return 404 when application not found', async () => {
      mockedService.deleteFertilizerApplication.mockRejectedValue(
        new FertilizerApplicationError('Aplicação não encontrada', 404),
      );

      const response = await request(app)
        .delete(`${BASE_URL}/non-existing`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });
});
