import request from 'supertest';
import { app } from '../../app';
import * as dewormingsService from './dewormings.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { DewormingError, type DewormingItem, type BulkDewormResult } from './dewormings.types';

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

jest.mock('./dewormings.service', () => ({
  createDeworming: jest.fn(),
  bulkDeworm: jest.fn(),
  listDewormings: jest.fn(),
  getDeworming: jest.fn(),
  updateDeworming: jest.fn(),
  deleteDeworming: jest.fn(),
  getDewormingReport: jest.fn(),
  exportDewormingReportCsv: jest.fn(),
  getNextDewormingAlerts: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(dewormingsService);
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

const SAMPLE_DEWORMING: DewormingItem = {
  id: 'dew-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  productId: 'prod-1',
  productName: 'Ivomec Gold',
  activeIngredient: 'Ivermectina',
  chemicalGroup: 'Avermectina',
  dosageMl: 5,
  administrationRoute: 'SC',
  administrationRouteLabel: 'Subcutâneo',
  productBatchNumber: 'LOT-2026-01',
  productExpiryDate: '2027-06-15',
  dewormingDate: '2026-03-14',
  responsibleName: 'João Silva',
  veterinaryName: 'Dr. Carlos',
  protocolItemId: null,
  campaignId: null,
  opgPre: 800,
  opgPost: null,
  opgPostDate: null,
  efficacyPercentage: null,
  withdrawalMeatDays: 35,
  withdrawalMilkDays: null,
  withdrawalEndDate: '2026-04-18',
  nextDewormingDate: null,
  rotationStatus: 'ROTATED',
  stockOutputId: 'output-1',
  animalLotId: null,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_BULK_RESULT: BulkDewormResult = {
  campaignId: 'camp-1',
  created: 10,
  animalCount: 10,
  stockOutputId: 'output-2',
  insufficientStockAlerts: [],
  rotationAlerts: [],
};

describe('Dewormings routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/dewormings', () => {
    const validInput = {
      animalId: 'animal-1',
      productId: 'prod-1',
      productName: 'Ivomec Gold',
      activeIngredient: 'Ivermectina',
      chemicalGroup: 'Avermectina',
      dosageMl: 5,
      administrationRoute: 'SC',
      dewormingDate: '2026-03-14',
      responsibleName: 'João Silva',
      opgPre: 800,
    };

    it('should create deworming and return 201', async () => {
      mockedService.createDeworming.mockResolvedValue(SAMPLE_DEWORMING);

      const res = await request(app)
        .post('/api/org/farms/farm-1/dewormings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('dew-1');
      expect(res.body.productName).toBe('Ivomec Gold');
      expect(res.body.rotationStatus).toBe('ROTATED');
      expect(mockedService.createDeworming).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when animal not found', async () => {
      mockedService.createDeworming.mockRejectedValue(
        new DewormingError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/dewormings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Animal não encontrado');
    });

    it('should return 400 for missing required fields', async () => {
      mockedService.createDeworming.mockRejectedValue(
        new DewormingError('Nome do vermífugo é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/dewormings')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should deny access to OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/dewormings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── BULK DEWORM ─────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/dewormings/bulk', () => {
    const validBulkInput = {
      animalLotId: 'lot-1',
      productId: 'prod-1',
      productName: 'Ivomec Gold',
      activeIngredient: 'Ivermectina',
      chemicalGroup: 'Avermectina',
      dosageMl: 5,
      administrationRoute: 'SC',
      dewormingDate: '2026-03-14',
      responsibleName: 'João Silva',
    };

    it('should bulk deworm and return 201', async () => {
      mockedService.bulkDeworm.mockResolvedValue(SAMPLE_BULK_RESULT);

      const res = await request(app)
        .post('/api/org/farms/farm-1/dewormings/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(201);
      expect(res.body.campaignId).toBe('camp-1');
      expect(res.body.animalCount).toBe(10);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return rotation alerts', async () => {
      const resultWithAlerts: BulkDewormResult = {
        ...SAMPLE_BULK_RESULT,
        rotationAlerts: [
          {
            animalId: 'a-1',
            animalEarTag: '001',
            status: 'CRITICAL',
            chemicalGroup: 'Avermectina',
            consecutiveCount: 3,
          },
        ],
      };
      mockedService.bulkDeworm.mockResolvedValue(resultWithAlerts);

      const res = await request(app)
        .post('/api/org/farms/farm-1/dewormings/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(201);
      expect(res.body.rotationAlerts).toHaveLength(1);
      expect(res.body.rotationAlerts[0].status).toBe('CRITICAL');
    });

    it('should return 404 when lot not found', async () => {
      mockedService.bulkDeworm.mockRejectedValue(new DewormingError('Lote não encontrado', 404));

      const res = await request(app)
        .post('/api/org/farms/farm-1/dewormings/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(404);
    });
  });

  // ─── LIST ────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/dewormings', () => {
    it('should list dewormings with pagination', async () => {
      mockedService.listDewormings.mockResolvedValue({
        data: [SAMPLE_DEWORMING],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/dewormings')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by animalId', async () => {
      mockedService.listDewormings.mockResolvedValue({ data: [], total: 0 });

      const res = await request(app)
        .get('/api/org/farms/farm-1/dewormings?animalId=animal-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockedService.listDewormings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ animalId: 'animal-1' }),
      );
    });

    it('should filter by date range', async () => {
      mockedService.listDewormings.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/dewormings?dateFrom=2026-01-01&dateTo=2026-03-31')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listDewormings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ dateFrom: '2026-01-01', dateTo: '2026-03-31' }),
      );
    });
  });

  // ─── GET ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/dewormings/:dewormingId', () => {
    it('should return deworming by id', async () => {
      mockedService.getDeworming.mockResolvedValue(SAMPLE_DEWORMING);

      const res = await request(app)
        .get('/api/org/farms/farm-1/dewormings/dew-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('dew-1');
    });

    it('should return 404 when not found', async () => {
      mockedService.getDeworming.mockRejectedValue(
        new DewormingError('Registro de vermifugação não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/dewormings/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE (includes OPG post + efficacy) ───────────────────────

  describe('PATCH /api/org/farms/:farmId/dewormings/:dewormingId', () => {
    it('should update deworming fields', async () => {
      const updated = { ...SAMPLE_DEWORMING, dosageMl: 10 };
      mockedService.updateDeworming.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/dewormings/dew-1')
        .set('Authorization', 'Bearer tok')
        .send({ dosageMl: 10 });

      expect(res.status).toBe(200);
      expect(res.body.dosageMl).toBe(10);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should update OPG post and calculate efficacy', async () => {
      const withEfficacy = {
        ...SAMPLE_DEWORMING,
        opgPost: 100,
        opgPostDate: '2026-03-28',
        efficacyPercentage: 87.5,
      };
      mockedService.updateDeworming.mockResolvedValue(withEfficacy);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/dewormings/dew-1')
        .set('Authorization', 'Bearer tok')
        .send({ opgPost: 100, opgPostDate: '2026-03-28' });

      expect(res.status).toBe(200);
      expect(res.body.opgPost).toBe(100);
      expect(res.body.efficacyPercentage).toBe(87.5);
    });

    it('should return 404 when not found', async () => {
      mockedService.updateDeworming.mockRejectedValue(
        new DewormingError('Registro de vermifugação não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/dewormings/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ dosageMl: 10 });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE ──────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/dewormings/:dewormingId', () => {
    it('should delete deworming', async () => {
      mockedService.deleteDeworming.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/dewormings/dew-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Registro de vermifugação excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deleteDeworming.mockRejectedValue(
        new DewormingError('Registro de vermifugação não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/dewormings/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/dewormings/dew-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── CAMPAIGN REPORT ─────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/dewormings/campaigns/:campaignId', () => {
    const SAMPLE_REPORT = {
      campaignId: 'camp-1',
      productName: 'Ivomec Gold',
      dewormingDate: '2026-03-14',
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
          dewormingDate: '2026-03-14',
          productName: 'Ivomec Gold',
          activeIngredient: 'Ivermectina',
          chemicalGroup: 'Avermectina',
          dosageMl: 5,
          administrationRoute: 'Subcutâneo',
          productBatchNumber: 'LOT-2026-01',
          opgPre: 800,
          responsibleName: 'João',
        },
      ],
    };

    it('should return campaign report', async () => {
      mockedService.getDewormingReport.mockResolvedValue(SAMPLE_REPORT);

      const res = await request(app)
        .get('/api/org/farms/farm-1/dewormings/campaigns/camp-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.campaignId).toBe('camp-1');
      expect(res.body.totalAnimals).toBe(2);
    });

    it('should return 404 for unknown campaign', async () => {
      mockedService.getDewormingReport.mockRejectedValue(
        new DewormingError('Campanha de vermifugação não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/dewormings/campaigns/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── CAMPAIGN EXPORT CSV ──────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/dewormings/campaigns/:campaignId/export', () => {
    it('should return CSV with correct headers', async () => {
      const csv = '\uFEFFCOMPROVANTE DE VERMIFUGAÇÃO\nBrinco;Nome;Categoria';
      mockedService.exportDewormingReportCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/dewormings/campaigns/camp-1/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('vermifugacao-camp-1.csv');
      expect(res.text).toContain('COMPROVANTE DE VERMIFUGAÇÃO');
    });
  });

  // ─── NEXT DEWORMING ALERTS (CA6) ──────────────────────────────────

  describe('GET /api/org/farms/:farmId/dewormings/alerts', () => {
    it('should return alerts for upcoming dewormings', async () => {
      const alerts = [
        {
          dewormingId: 'dew-1',
          animalId: 'a-1',
          animalEarTag: '001',
          animalName: 'Mimosa',
          productName: 'Ivomec Gold',
          nextDewormingDate: '2026-04-14',
          daysUntil: 31,
        },
      ];
      mockedService.getNextDewormingAlerts.mockResolvedValue(alerts);

      const res = await request(app)
        .get('/api/org/farms/farm-1/dewormings/alerts')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].animalEarTag).toBe('001');
    });

    it('should accept daysAhead query param', async () => {
      mockedService.getNextDewormingAlerts.mockResolvedValue([]);

      await request(app)
        .get('/api/org/farms/farm-1/dewormings/alerts?daysAhead=60')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getNextDewormingAlerts).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        60,
      );
    });
  });
});
