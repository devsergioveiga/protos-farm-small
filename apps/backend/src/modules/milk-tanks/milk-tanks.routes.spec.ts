import request from 'supertest';
import { app } from '../../app';
import * as milkTanksService from './milk-tanks.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  MilkTankError,
  type TankItem,
  type MeasurementItem,
  type CollectionItem,
  type ReconciliationItem,
  type MonthlyReportItem,
} from './milk-tanks.types';

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

jest.mock('./milk-tanks.service', () => ({
  createTank: jest.fn(),
  listTanks: jest.fn(),
  getTank: jest.fn(),
  updateTank: jest.fn(),
  deleteTank: jest.fn(),
  recordMeasurement: jest.fn(),
  listMeasurements: jest.fn(),
  createCollection: jest.fn(),
  listCollections: jest.fn(),
  getCollection: jest.fn(),
  updateCollection: jest.fn(),
  deleteCollection: jest.fn(),
  uploadCollectionTicket: jest.fn(),
  getReconciliation: jest.fn(),
  getMonthlyReport: jest.fn(),
  exportCollectionsCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(milkTanksService);
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

const SAMPLE_TANK: TankItem = {
  id: 'tank-1',
  farmId: 'farm-1',
  name: 'Tanque Principal',
  capacityLiters: 2000,
  location: 'Curral',
  serialNumber: 'SN-12345',
  isActive: true,
  createdAt: '2026-03-15T00:00:00.000Z',
  updatedAt: '2026-03-15T00:00:00.000Z',
};

const SAMPLE_MEASUREMENT: MeasurementItem = {
  id: 'meas-1',
  tankId: 'tank-1',
  tankName: 'Tanque Principal',
  measureDate: '2026-03-14',
  volumeLiters: 850.5,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-14T06:00:00.000Z',
};

const SAMPLE_COLLECTION: CollectionItem = {
  id: 'col-1',
  farmId: 'farm-1',
  tankId: 'tank-1',
  tankName: 'Tanque Principal',
  collectionDate: '2026-03-14',
  collectionTime: '06:30',
  dairyCompany: 'Laticínio São José',
  driverName: 'João',
  volumeLiters: 800,
  sampleCollected: true,
  milkTemperature: 4.2,
  ticketNumber: 'T-001',
  ticketPhotoPath: null,
  ticketPhotoName: null,
  productionLiters: 820,
  divergencePercent: -2.44,
  divergenceAlert: false,
  pricePerLiter: 2.5,
  grossValue: 2000,
  qualityDiscount: 50,
  freightDiscount: 30,
  otherDiscounts: 0,
  netValue: 1920,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-14T07:00:00.000Z',
  updatedAt: '2026-03-14T07:00:00.000Z',
};

const SAMPLE_RECONCILIATION: ReconciliationItem[] = [
  {
    date: '2026-03-14',
    productionLiters: 820,
    collectionLiters: 800,
    tankVolumeLiters: 850,
    divergencePercent: -2.44,
    divergenceAlert: false,
  },
  {
    date: '2026-03-15',
    productionLiters: 900,
    collectionLiters: 820,
    tankVolumeLiters: null,
    divergencePercent: -8.89,
    divergenceAlert: true,
  },
];

const SAMPLE_MONTHLY_REPORT: MonthlyReportItem = {
  month: '2026-03',
  totalVolumeDelivered: 24000,
  collectionCount: 30,
  avgPricePerLiter: 2.5,
  grossValue: 60000,
  qualityDiscount: 1500,
  freightDiscount: 900,
  otherDiscounts: 0,
  totalDiscounts: 2400,
  netValue: 57600,
};

describe('Milk tanks & collections routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ═══════════════════════════════════════════════════════════════════
  // TANK CRUD (CA1)
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/org/farms/:farmId/milk-tanks', () => {
    const validInput = { name: 'Tanque Principal', capacityLiters: 2000, location: 'Curral' };

    it('should create tank and return 201', async () => {
      mockedService.createTank.mockResolvedValue(SAMPLE_TANK);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-tanks')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('tank-1');
      expect(res.body.name).toBe('Tanque Principal');
      expect(res.body.capacityLiters).toBe(2000);
      expect(mockedService.createTank).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for invalid capacity', async () => {
      mockedService.createTank.mockRejectedValue(
        new MilkTankError('Capacidade em litros deve ser maior que zero', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-tanks')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Tank', capacityLiters: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Capacidade');
    });

    it('should deny OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-tanks')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/org/farms/:farmId/milk-tanks', () => {
    it('should list active tanks', async () => {
      mockedService.listTanks.mockResolvedValue([SAMPLE_TANK]);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-tanks')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Tanque Principal');
    });
  });

  describe('GET /api/org/farms/:farmId/milk-tanks/:tankId', () => {
    it('should return tank by id', async () => {
      mockedService.getTank.mockResolvedValue(SAMPLE_TANK);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-tanks/tank-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('tank-1');
    });

    it('should return 404 when not found', async () => {
      mockedService.getTank.mockRejectedValue(new MilkTankError('Tanque não encontrado', 404));

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-tanks/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/org/farms/:farmId/milk-tanks/:tankId', () => {
    it('should update tank', async () => {
      const updated = { ...SAMPLE_TANK, name: 'Tanque Reserva' };
      mockedService.updateTank.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/milk-tanks/tank-1')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Tanque Reserva' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Tanque Reserva');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/org/farms/:farmId/milk-tanks/:tankId', () => {
    it('should deactivate tank', async () => {
      mockedService.deleteTank.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milk-tanks/tank-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Tanque desativado com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deleteTank.mockRejectedValue(new MilkTankError('Tanque não encontrado', 404));

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milk-tanks/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milk-tanks/tank-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TANK MEASUREMENTS (CA2)
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/org/farms/:farmId/milk-tanks/:tankId/measurements', () => {
    const validInput = { measureDate: '2026-03-14', volumeLiters: 850.5 };

    it('should record measurement and return 201', async () => {
      mockedService.recordMeasurement.mockResolvedValue(SAMPLE_MEASUREMENT);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-tanks/tank-1/measurements')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.volumeLiters).toBe(850.5);
      expect(res.body.measureDate).toBe('2026-03-14');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when tank not found', async () => {
      mockedService.recordMeasurement.mockRejectedValue(
        new MilkTankError('Tanque não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-tanks/unknown/measurements')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
    });

    it('should return 400 when volume exceeds capacity', async () => {
      mockedService.recordMeasurement.mockRejectedValue(
        new MilkTankError('Volume (3000L) excede a capacidade do tanque (2000L)', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-tanks/tank-1/measurements')
        .set('Authorization', 'Bearer tok')
        .send({ measureDate: '2026-03-14', volumeLiters: 3000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('excede a capacidade');
    });
  });

  describe('GET /api/org/farms/:farmId/milk-tanks/:tankId/measurements', () => {
    it('should list measurements with pagination', async () => {
      mockedService.listMeasurements.mockResolvedValue({
        data: [SAMPLE_MEASUREMENT],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-tanks/tank-1/measurements')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by date range', async () => {
      mockedService.listMeasurements.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get(
          '/api/org/farms/farm-1/milk-tanks/tank-1/measurements?dateFrom=2026-03-01&dateTo=2026-03-31',
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listMeasurements).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'tank-1',
        expect.objectContaining({ dateFrom: '2026-03-01', dateTo: '2026-03-31' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MILK COLLECTIONS (CA3)
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/org/farms/:farmId/milk-collections', () => {
    const validInput = {
      collectionDate: '2026-03-14',
      collectionTime: '06:30',
      dairyCompany: 'Laticínio São José',
      driverName: 'João',
      volumeLiters: 800,
      sampleCollected: true,
      milkTemperature: 4.2,
      ticketNumber: 'T-001',
    };

    it('should create collection with reconciliation and return 201', async () => {
      mockedService.createCollection.mockResolvedValue(SAMPLE_COLLECTION);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-collections')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('col-1');
      expect(res.body.dairyCompany).toBe('Laticínio São José');
      expect(res.body.volumeLiters).toBe(800);
      expect(res.body.productionLiters).toBe(820);
      expect(res.body.divergencePercent).toBe(-2.44);
      expect(res.body.divergenceAlert).toBe(false);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing dairyCompany', async () => {
      mockedService.createCollection.mockRejectedValue(
        new MilkTankError('Laticínio é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-collections')
        .set('Authorization', 'Bearer tok')
        .send({ collectionDate: '2026-03-14', volumeLiters: 800 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Laticínio');
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-collections')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/org/farms/:farmId/milk-collections', () => {
    it('should list collections with pagination', async () => {
      mockedService.listCollections.mockResolvedValue({
        data: [SAMPLE_COLLECTION],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-collections')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by dairyCompany and divergenceAlert', async () => {
      mockedService.listCollections.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/milk-collections?dairyCompany=São José&divergenceAlert=true')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listCollections).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({
          dairyCompany: 'São José',
          divergenceAlert: true,
        }),
      );
    });
  });

  describe('GET /api/org/farms/:farmId/milk-collections/:collectionId', () => {
    it('should return collection by id', async () => {
      mockedService.getCollection.mockResolvedValue(SAMPLE_COLLECTION);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-collections/col-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('col-1');
      expect(res.body.milkTemperature).toBe(4.2);
    });

    it('should return 404 when not found', async () => {
      mockedService.getCollection.mockRejectedValue(
        new MilkTankError('Coleta não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-collections/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/org/farms/:farmId/milk-collections/:collectionId', () => {
    it('should update financial data', async () => {
      const updated = { ...SAMPLE_COLLECTION, pricePerLiter: 2.8, grossValue: 2240 };
      mockedService.updateCollection.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/milk-collections/col-1')
        .set('Authorization', 'Bearer tok')
        .send({ pricePerLiter: 2.8, grossValue: 2240 });

      expect(res.status).toBe(200);
      expect(res.body.pricePerLiter).toBe(2.8);
      expect(res.body.grossValue).toBe(2240);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.updateCollection.mockRejectedValue(
        new MilkTankError('Coleta não encontrada', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/milk-collections/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ pricePerLiter: 2.8 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/org/farms/:farmId/milk-collections/:collectionId', () => {
    it('should delete collection', async () => {
      mockedService.deleteCollection.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milk-collections/col-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Coleta excluída com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milk-collections/col-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RECONCILIATION (CA5 / CA7)
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/org/farms/:farmId/milk-collections/reconciliation', () => {
    it('should return reconciliation with divergence alerts', async () => {
      mockedService.getReconciliation.mockResolvedValue(SAMPLE_RECONCILIATION);

      const res = await request(app)
        .get(
          '/api/org/farms/farm-1/milk-collections/reconciliation?dateFrom=2026-03-14&dateTo=2026-03-15',
        )
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].divergenceAlert).toBe(false);
      expect(res.body[1].divergenceAlert).toBe(true);
      expect(res.body[1].divergencePercent).toBe(-8.89);
    });

    it('should return 400 when missing date range', async () => {
      mockedService.getReconciliation.mockRejectedValue(
        new MilkTankError('Período (dateFrom e dateTo) é obrigatório', 400),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-collections/reconciliation')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MONTHLY REPORT (CA6)
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/org/farms/:farmId/milk-collections/monthly-report', () => {
    it('should return monthly financial report', async () => {
      mockedService.getMonthlyReport.mockResolvedValue(SAMPLE_MONTHLY_REPORT);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-collections/monthly-report?month=2026-03')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.month).toBe('2026-03');
      expect(res.body.totalVolumeDelivered).toBe(24000);
      expect(res.body.avgPricePerLiter).toBe(2.5);
      expect(res.body.grossValue).toBe(60000);
      expect(res.body.totalDiscounts).toBe(2400);
      expect(res.body.netValue).toBe(57600);
      expect(res.body.collectionCount).toBe(30);
    });

    it('should return 400 for invalid month format', async () => {
      mockedService.getMonthlyReport.mockRejectedValue(
        new MilkTankError('Mês inválido. Use o formato YYYY-MM', 400),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-collections/monthly-report?month=invalid')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT CSV
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/org/farms/:farmId/milk-collections/export', () => {
    it('should return CSV with correct headers', async () => {
      const csv = '\uFEFFRELATÓRIO DE COLETAS DE LEITE\nData;Horário;Laticínio';
      mockedService.exportCollectionsCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milk-collections/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('coletas-leite-');
      expect(res.text).toContain('RELATÓRIO DE COLETAS DE LEITE');
    });

    it('should pass filter params to export', async () => {
      mockedService.exportCollectionsCsv.mockResolvedValue('\uFEFF');

      await request(app)
        .get(
          '/api/org/farms/farm-1/milk-collections/export?dateFrom=2026-03-01&dairyCompany=São José',
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.exportCollectionsCsv).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ dateFrom: '2026-03-01', dairyCompany: 'São José' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TICKET UPLOAD (CA4)
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/org/farms/:farmId/milk-collections/:collectionId/ticket', () => {
    it('should upload ticket photo', async () => {
      const withTicket = {
        ...SAMPLE_COLLECTION,
        ticketPhotoPath: '/uploads/collection-tickets/col-1.jpg',
        ticketPhotoName: 'ticket.jpg',
      };
      mockedService.uploadCollectionTicket.mockResolvedValue(withTicket);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-collections/col-1/ticket')
        .set('Authorization', 'Bearer tok')
        .attach('file', Buffer.from('fake-image'), 'ticket.jpg');

      expect(res.status).toBe(200);
      expect(res.body.ticketPhotoName).toBe('ticket.jpg');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 when no file sent', async () => {
      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-collections/col-1/ticket')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Nenhum arquivo enviado');
    });

    it('should return 404 when collection not found', async () => {
      mockedService.uploadCollectionTicket.mockRejectedValue(
        new MilkTankError('Coleta não encontrada', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milk-collections/unknown/ticket')
        .set('Authorization', 'Bearer tok')
        .attach('file', Buffer.from('fake-image'), 'ticket.jpg');

      expect(res.status).toBe(404);
    });
  });
});
