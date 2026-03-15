import request from 'supertest';
import { app } from '../../app';
import * as vaccinationsService from './vaccinations.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  VaccinationError,
  type VaccinationItem,
  type BulkVaccinateResult,
} from './vaccinations.types';

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

jest.mock('./vaccinations.service', () => ({
  createVaccination: jest.fn(),
  bulkVaccinate: jest.fn(),
  listVaccinations: jest.fn(),
  getVaccination: jest.fn(),
  updateVaccination: jest.fn(),
  deleteVaccination: jest.fn(),
  getVaccinationReport: jest.fn(),
  exportVaccinationReportCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(vaccinationsService);
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

const SAMPLE_VACCINATION: VaccinationItem = {
  id: 'vac-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  productId: 'prod-1',
  productName: 'Vacina clostridioses',
  dosageMl: 5,
  administrationRoute: 'SC',
  administrationRouteLabel: 'Subcutâneo',
  productBatchNumber: 'LOT-2026-01',
  productExpiryDate: '2027-06-15',
  vaccinationDate: '2026-03-14',
  responsibleName: 'João Silva',
  veterinaryName: 'Dr. Carlos',
  protocolItemId: null,
  campaignId: null,
  doseNumber: 1,
  nextDoseDate: '2026-04-14',
  withdrawalMeatDays: null,
  withdrawalMilkDays: null,
  withdrawalEndDate: null,
  stockOutputId: 'output-1',
  animalLotId: null,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_BULK_RESULT: BulkVaccinateResult = {
  campaignId: 'camp-1',
  created: 10,
  animalCount: 10,
  stockOutputId: 'output-2',
  insufficientStockAlerts: [],
};

describe('Vaccinations routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1) ──────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/vaccinations', () => {
    const validInput = {
      animalId: 'animal-1',
      productId: 'prod-1',
      productName: 'Vacina clostridioses',
      dosageMl: 5,
      administrationRoute: 'SC',
      vaccinationDate: '2026-03-14',
      responsibleName: 'João Silva',
    };

    it('should create vaccination and return 201', async () => {
      mockedService.createVaccination.mockResolvedValue(SAMPLE_VACCINATION);

      const res = await request(app)
        .post('/api/org/farms/farm-1/vaccinations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('vac-1');
      expect(res.body.productName).toBe('Vacina clostridioses');
      expect(mockedService.createVaccination).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when animal not found', async () => {
      mockedService.createVaccination.mockRejectedValue(
        new VaccinationError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/vaccinations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Animal não encontrado');
    });

    it('should return 400 for missing required fields', async () => {
      mockedService.createVaccination.mockRejectedValue(
        new VaccinationError('Nome da vacina é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/vaccinations')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should deny access to OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/vaccinations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── BULK VACCINATE (CA2) ──────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/vaccinations/bulk', () => {
    const validBulkInput = {
      animalLotId: 'lot-1',
      productId: 'prod-1',
      productName: 'Vacina clostridioses',
      dosageMl: 5,
      administrationRoute: 'IM',
      vaccinationDate: '2026-03-14',
      responsibleName: 'João Silva',
    };

    it('should bulk vaccinate and return 201', async () => {
      mockedService.bulkVaccinate.mockResolvedValue(SAMPLE_BULK_RESULT);

      const res = await request(app)
        .post('/api/org/farms/farm-1/vaccinations/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(201);
      expect(res.body.campaignId).toBe('camp-1');
      expect(res.body.animalCount).toBe(10);
      expect(res.body.stockOutputId).toBe('output-2');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when lot not found', async () => {
      mockedService.bulkVaccinate.mockRejectedValue(
        new VaccinationError('Lote não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/vaccinations/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(404);
    });

    it('should return stock alerts when insufficient', async () => {
      const resultWithAlerts: BulkVaccinateResult = {
        ...SAMPLE_BULK_RESULT,
        insufficientStockAlerts: [
          { productId: 'prod-1', productName: 'Vacina', requested: 50, available: 10 },
        ],
      };
      mockedService.bulkVaccinate.mockResolvedValue(resultWithAlerts);

      const res = await request(app)
        .post('/api/org/farms/farm-1/vaccinations/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(201);
      expect(res.body.insufficientStockAlerts).toHaveLength(1);
    });
  });

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/vaccinations', () => {
    it('should list vaccinations with pagination', async () => {
      mockedService.listVaccinations.mockResolvedValue({
        data: [SAMPLE_VACCINATION],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/vaccinations')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by animalId', async () => {
      mockedService.listVaccinations.mockResolvedValue({ data: [], total: 0 });

      const res = await request(app)
        .get('/api/org/farms/farm-1/vaccinations?animalId=animal-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockedService.listVaccinations).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ animalId: 'animal-1' }),
      );
    });

    it('should filter by date range', async () => {
      mockedService.listVaccinations.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/vaccinations?dateFrom=2026-01-01&dateTo=2026-03-31')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listVaccinations).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ dateFrom: '2026-01-01', dateTo: '2026-03-31' }),
      );
    });
  });

  // ─── GET ───────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/vaccinations/:vaccinationId', () => {
    it('should return vaccination by id', async () => {
      mockedService.getVaccination.mockResolvedValue(SAMPLE_VACCINATION);

      const res = await request(app)
        .get('/api/org/farms/farm-1/vaccinations/vac-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('vac-1');
    });

    it('should return 404 when not found', async () => {
      mockedService.getVaccination.mockRejectedValue(
        new VaccinationError('Registro de vacinação não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/vaccinations/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/vaccinations/:vaccinationId', () => {
    it('should update vaccination fields', async () => {
      const updated = { ...SAMPLE_VACCINATION, dosageMl: 10 };
      mockedService.updateVaccination.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/vaccinations/vac-1')
        .set('Authorization', 'Bearer tok')
        .send({ dosageMl: 10 });

      expect(res.status).toBe(200);
      expect(res.body.dosageMl).toBe(10);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.updateVaccination.mockRejectedValue(
        new VaccinationError('Registro de vacinação não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/vaccinations/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ dosageMl: 10 });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/vaccinations/:vaccinationId', () => {
    it('should delete vaccination', async () => {
      mockedService.deleteVaccination.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/vaccinations/vac-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Registro de vacinação excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deleteVaccination.mockRejectedValue(
        new VaccinationError('Registro de vacinação não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/vaccinations/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/vaccinations/vac-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── CAMPAIGN REPORT (CA6) ────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/vaccinations/campaigns/:campaignId', () => {
    const SAMPLE_REPORT = {
      campaignId: 'camp-1',
      productName: 'Vacina clostridioses',
      vaccinationDate: '2026-03-14',
      farmName: 'Fazenda A',
      totalAnimals: 2,
      animals: [
        {
          animalId: 'a-1',
          animalEarTag: '001',
          animalName: 'Mimosa',
          animalCategory: 'VACA',
          lotName: 'Lote 1',
          farmName: 'Fazenda A',
          vaccinationDate: '2026-03-14',
          productName: 'Vacina clostridioses',
          dosageMl: 5,
          administrationRoute: 'Subcutâneo',
          productBatchNumber: 'LOT-2026-01',
          doseNumber: 1,
          responsibleName: 'João',
        },
      ],
    };

    it('should return campaign report', async () => {
      mockedService.getVaccinationReport.mockResolvedValue(SAMPLE_REPORT);

      const res = await request(app)
        .get('/api/org/farms/farm-1/vaccinations/campaigns/camp-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.campaignId).toBe('camp-1');
      expect(res.body.totalAnimals).toBe(2);
    });

    it('should return 404 for unknown campaign', async () => {
      mockedService.getVaccinationReport.mockRejectedValue(
        new VaccinationError('Campanha de vacinação não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/vaccinations/campaigns/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── CAMPAIGN EXPORT CSV (CA6) ────────────────────────────────────

  describe('GET /api/org/farms/:farmId/vaccinations/campaigns/:campaignId/export', () => {
    it('should return CSV with correct headers', async () => {
      const csv = '\uFEFFCOMPROVANTE DE VACINAÇÃO\nBrinco;Nome;Categoria';
      mockedService.exportVaccinationReportCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/vaccinations/campaigns/camp-1/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('vacinacao-camp-1.csv');
      expect(res.text).toContain('COMPROVANTE DE VACINAÇÃO');
    });
  });
});
