import request from 'supertest';
import { app } from '../../app';
import * as pesticideService from './pesticide-applications.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { PesticideApplicationError } from './pesticide-applications.types';

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

jest.mock('./pesticide-applications.service', () => ({
  createPesticideApplication: jest.fn(),
  listPesticideApplications: jest.fn(),
  getPesticideApplication: jest.fn(),
  updatePesticideApplication: jest.fn(),
  deletePesticideApplication: jest.fn(),
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

const mockedService = jest.mocked(pesticideService);
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
const APP_ID = 'app-1';

const SAMPLE_APPLICATION = {
  id: APP_ID,
  farmId: FARM_ID,
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão Norte',
  appliedAt: '2026-03-08T10:00:00.000Z',
  productName: 'Roundup Ready',
  activeIngredient: 'Glifosato',
  dose: 2.5,
  doseUnit: 'L_HA',
  sprayVolume: 150,
  target: 'PLANTA_DANINHA',
  targetDescription: 'Buva',
  artNumber: 'ART-2026-001234',
  agronomistCrea: 'CREA-SP 5012345678',
  technicalJustification: 'Alta infestação de buva',
  temperature: 28.5,
  relativeHumidity: 62.0,
  windSpeed: 8.0,
  sprayerType: 'BARRA_TRATORIZADO',
  nozzleType: 'LEQUE',
  workingPressure: 3.5,
  applicationSpeed: 6.0,
  adjuvant: null,
  adjuvantDose: null,
  tankMixOrder: null,
  tankMixPh: null,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin User',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const BASE_URL = `/api/org/farms/${FARM_ID}/pesticide-applications`;

describe('Pesticide Application endpoints', () => {
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
      mockedService.listPesticideApplications.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
      const response = await request(app).get(BASE_URL).set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(200);
    });
  });

  // ─── POST ─────────────────────────────────────────────────────────

  describe('POST /org/farms/:farmId/pesticide-applications', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should create application and return 201', async () => {
      mockedService.createPesticideApplication.mockResolvedValue(SAMPLE_APPLICATION as never);

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          appliedAt: '2026-03-08T10:00:00.000Z',
          productName: 'Roundup Ready',
          activeIngredient: 'Glifosato',
          dose: 2.5,
          doseUnit: 'L_HA',
          sprayVolume: 150,
          target: 'PLANTA_DANINHA',
          targetDescription: 'Buva',
        });

      expect(response.status).toBe(201);
      expect(response.body.productName).toBe('Roundup Ready');
      expect(response.body.activeIngredient).toBe('Glifosato');
      expect(response.body.dose).toBe(2.5);
      expect(response.body.target).toBe('PLANTA_DANINHA');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_PESTICIDE_APPLICATION' }),
      );
    });

    it('should return 400 when service throws PesticideApplicationError(400)', async () => {
      mockedService.createPesticideApplication.mockRejectedValue(
        new PesticideApplicationError('Dose deve ser maior que zero', 400),
      );

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Dose deve ser maior que zero');
    });

    it('should return 404 when plot not found', async () => {
      mockedService.createPesticideApplication.mockRejectedValue(
        new PesticideApplicationError('Talhão não encontrado nesta fazenda', 404),
      );

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({ fieldPlotId: 'invalid' });

      expect(response.status).toBe(404);
    });

    it('should create application with environmental conditions', async () => {
      const withConditions = {
        ...SAMPLE_APPLICATION,
        temperature: 32.0,
        relativeHumidity: 50.0,
        windSpeed: 12.0,
      };
      mockedService.createPesticideApplication.mockResolvedValue(withConditions as never);

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          appliedAt: '2026-03-08T10:00:00.000Z',
          productName: 'Roundup Ready',
          activeIngredient: 'Glifosato',
          dose: 2.5,
          sprayVolume: 150,
          target: 'PLANTA_DANINHA',
          temperature: 32.0,
          relativeHumidity: 50.0,
          windSpeed: 12.0,
        });

      expect(response.status).toBe(201);
      expect(response.body.temperature).toBe(32.0);
      expect(response.body.relativeHumidity).toBe(50.0);
      expect(response.body.windSpeed).toBe(12.0);
    });

    it('should create application with equipment data', async () => {
      const withEquipment = {
        ...SAMPLE_APPLICATION,
        sprayerType: 'AUTOPROPELIDO',
        nozzleType: 'INDUÇÃO_AR',
        workingPressure: 4.0,
        applicationSpeed: 8.5,
      };
      mockedService.createPesticideApplication.mockResolvedValue(withEquipment as never);

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          appliedAt: '2026-03-08T10:00:00.000Z',
          productName: 'Roundup Ready',
          activeIngredient: 'Glifosato',
          dose: 2.5,
          sprayVolume: 150,
          target: 'PLANTA_DANINHA',
          sprayerType: 'AUTOPROPELIDO',
          nozzleType: 'INDUÇÃO_AR',
          workingPressure: 4.0,
          applicationSpeed: 8.5,
        });

      expect(response.status).toBe(201);
      expect(response.body.sprayerType).toBe('AUTOPROPELIDO');
      expect(response.body.nozzleType).toBe('INDUÇÃO_AR');
      expect(response.body.workingPressure).toBe(4.0);
      expect(response.body.applicationSpeed).toBe(8.5);
    });

    it('should create application with tank mix data', async () => {
      const withTankMix = {
        ...SAMPLE_APPLICATION,
        adjuvant: 'Nimbus',
        adjuvantDose: 500,
        tankMixOrder: 'Água → Adjuvante → Herbicida',
        tankMixPh: 6.5,
      };
      mockedService.createPesticideApplication.mockResolvedValue(withTankMix as never);

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          appliedAt: '2026-03-08T10:00:00.000Z',
          productName: 'Roundup Ready',
          activeIngredient: 'Glifosato',
          dose: 2.5,
          sprayVolume: 150,
          target: 'PLANTA_DANINHA',
          adjuvant: 'Nimbus',
          adjuvantDose: 500,
          tankMixOrder: 'Água → Adjuvante → Herbicida',
          tankMixPh: 6.5,
        });

      expect(response.status).toBe(201);
      expect(response.body.adjuvant).toBe('Nimbus');
      expect(response.body.adjuvantDose).toBe(500);
      expect(response.body.tankMixOrder).toBe('Água → Adjuvante → Herbicida');
      expect(response.body.tankMixPh).toBe(6.5);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.createPesticideApplication.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post(BASE_URL)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── GET list ─────────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/pesticide-applications', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should list with pagination and filters', async () => {
      mockedService.listPesticideApplications.mockResolvedValue({
        data: [SAMPLE_APPLICATION as never],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const response = await request(app)
        .get(`${BASE_URL}?page=1&target=PRAGA&search=Round`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.total).toBe(1);
    });
  });

  // ─── GET single ───────────────────────────────────────────────────

  describe('GET /org/farms/:farmId/pesticide-applications/:applicationId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return single application', async () => {
      mockedService.getPesticideApplication.mockResolvedValue(SAMPLE_APPLICATION as never);

      const response = await request(app)
        .get(`${BASE_URL}/${APP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(APP_ID);
    });

    it('should return 404 for non-existing application', async () => {
      mockedService.getPesticideApplication.mockRejectedValue(
        new PesticideApplicationError('Aplicação não encontrada', 404),
      );

      const response = await request(app)
        .get(`${BASE_URL}/non-existing`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH ────────────────────────────────────────────────────────

  describe('PATCH /org/farms/:farmId/pesticide-applications/:applicationId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should update application', async () => {
      const updated = { ...SAMPLE_APPLICATION, dose: 3.0 };
      mockedService.updatePesticideApplication.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch(`${BASE_URL}/${APP_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ dose: 3.0 });

      expect(response.status).toBe(200);
      expect(response.body.dose).toBe(3.0);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_PESTICIDE_APPLICATION' }),
      );
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /org/farms/:farmId/pesticide-applications/:applicationId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should soft delete and return 204', async () => {
      mockedService.deletePesticideApplication.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`${BASE_URL}/${APP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_PESTICIDE_APPLICATION' }),
      );
    });

    it('should return 404 when application not found', async () => {
      mockedService.deletePesticideApplication.mockRejectedValue(
        new PesticideApplicationError('Aplicação não encontrada', 404),
      );

      const response = await request(app)
        .delete(`${BASE_URL}/non-existing`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });
});
