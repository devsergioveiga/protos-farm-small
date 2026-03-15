import request from 'supertest';
import { app } from '../../app';
import * as feedingService from './feeding-records.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  FeedingRecordError,
  type FeedingRecordResponse,
  type FeedingRecordListItem,
  type ConsumptionIndicators,
} from './feeding-records.types';

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

jest.mock('./feeding-records.service', () => ({
  createFeedingRecord: jest.fn(),
  recordLeftovers: jest.fn(),
  listFeedingRecords: jest.fn(),
  getFeedingRecord: jest.fn(),
  updateFeedingRecord: jest.fn(),
  deleteFeedingRecord: jest.fn(),
  getConsumptionIndicators: jest.fn(),
  exportFeedingsCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(feedingService);
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

const SAMPLE_ITEM = {
  id: 'item-1',
  feedingRecordId: 'feed-1',
  feedIngredientId: 'ing-1',
  feedIngredientName: 'Silagem de milho',
  productId: null,
  quantityProvidedKg: 50,
  quantityLeftoverKg: null,
  quantityConsumedKg: null,
};

const SAMPLE_RECORD: FeedingRecordResponse = {
  id: 'feed-1',
  farmId: 'farm-1',
  organizationId: 'org-1',
  lotId: 'lot-1',
  lotName: 'Lote Vacas Lactação',
  feedingDate: '2026-03-15',
  shift: 'MORNING',
  shiftLabel: 'Manhã',
  dietId: 'diet-1',
  dietName: 'Dieta Lactação v1',
  animalCount: 30,
  totalProvidedKg: 150,
  totalLeftoverKg: null,
  totalConsumedKg: null,
  leftoverPercent: null,
  leftoverAlert: false,
  leftoverAlertType: 'NONE',
  leftoverAlertLabel: 'Normal',
  consumptionPerAnimalKg: null,
  responsibleName: 'João Silva',
  stockOutputId: null,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  items: [SAMPLE_ITEM],
  createdAt: '2026-03-15T08:00:00.000Z',
};

const SAMPLE_LIST_ITEM: FeedingRecordListItem = {
  id: 'feed-1',
  farmId: 'farm-1',
  lotId: 'lot-1',
  lotName: 'Lote Vacas Lactação',
  feedingDate: '2026-03-15',
  shift: 'MORNING',
  shiftLabel: 'Manhã',
  dietName: 'Dieta Lactação v1',
  animalCount: 30,
  totalProvidedKg: 150,
  totalLeftoverKg: 8,
  totalConsumedKg: 142,
  leftoverPercent: 5.33,
  leftoverAlert: false,
  leftoverAlertType: 'NONE',
  consumptionPerAnimalKg: 4.733,
  responsibleName: 'João Silva',
  createdAt: '2026-03-15T08:00:00.000Z',
};

describe('Feeding Records routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/feeding-records', () => {
    const validInput = {
      lotId: 'lot-1',
      feedingDate: '2026-03-15',
      shift: 'MORNING',
      dietId: 'diet-1',
      responsibleName: 'João Silva',
      items: [
        {
          feedIngredientId: 'ing-1',
          feedIngredientName: 'Silagem de milho',
          quantityProvidedKg: 50,
        },
        {
          feedIngredientId: 'ing-2',
          feedIngredientName: 'Farelo de soja',
          quantityProvidedKg: 20,
        },
      ],
    };

    it('should create feeding record and return 201', async () => {
      mockedService.createFeedingRecord.mockResolvedValue(SAMPLE_RECORD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/feeding-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('feed-1');
      expect(res.body.lotName).toBe('Lote Vacas Lactação');
      expect(res.body.shift).toBe('MORNING');
      expect(res.body.totalProvidedKg).toBe(150);
      expect(mockedService.createFeedingRecord).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when lot not found', async () => {
      mockedService.createFeedingRecord.mockRejectedValue(
        new FeedingRecordError('Lote não encontrado nesta fazenda', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/feeding-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Lote não encontrado nesta fazenda');
    });

    it('should return 400 for missing required fields', async () => {
      mockedService.createFeedingRecord.mockRejectedValue(
        new FeedingRecordError('Lote é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/feeding-records')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should deny access to OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/feeding-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST ────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/feeding-records', () => {
    it('should return paginated list', async () => {
      mockedService.listFeedingRecords.mockResolvedValue({
        data: [SAMPLE_LIST_ITEM],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/feeding-records')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].lotName).toBe('Lote Vacas Lactação');
      expect(res.body.meta.total).toBe(1);
    });

    it('should pass query params', async () => {
      mockedService.listFeedingRecords.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/org/farms/farm-1/feeding-records?lotId=lot-1&shift=MORNING&dateFrom=2026-03-01')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listFeedingRecords).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({
          lotId: 'lot-1',
          shift: 'MORNING',
          dateFrom: '2026-03-01',
        }),
      );
    });
  });

  // ─── GET ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/feeding-records/:feedingId', () => {
    it('should return feeding record with items', async () => {
      mockedService.getFeedingRecord.mockResolvedValue(SAMPLE_RECORD);

      const res = await request(app)
        .get('/api/org/farms/farm-1/feeding-records/feed-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('feed-1');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].feedIngredientName).toBe('Silagem de milho');
    });

    it('should return 404 when not found', async () => {
      mockedService.getFeedingRecord.mockRejectedValue(
        new FeedingRecordError('Registro de trato não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/feeding-records/nope')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/feeding-records/:feedingId', () => {
    it('should update and return record', async () => {
      const updated = { ...SAMPLE_RECORD, responsibleName: 'Maria Souza' };
      mockedService.updateFeedingRecord.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/feeding-records/feed-1')
        .set('Authorization', 'Bearer tok')
        .send({ responsibleName: 'Maria Souza' });

      expect(res.status).toBe(200);
      expect(res.body.responsibleName).toBe('Maria Souza');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  // ─── RECORD LEFTOVERS (CA2, CA3) ─────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/feeding-records/:feedingId/leftovers', () => {
    it('should record leftovers and recalculate', async () => {
      const withLeftovers: FeedingRecordResponse = {
        ...SAMPLE_RECORD,
        totalLeftoverKg: 8,
        totalConsumedKg: 142,
        leftoverPercent: 5.33,
        leftoverAlert: false,
        leftoverAlertType: 'NONE',
        leftoverAlertLabel: 'Normal',
        consumptionPerAnimalKg: 4.733,
        items: [
          {
            ...SAMPLE_ITEM,
            quantityLeftoverKg: 8,
            quantityConsumedKg: 42,
          },
        ],
      };
      mockedService.recordLeftovers.mockResolvedValue(withLeftovers);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/feeding-records/feed-1/leftovers')
        .set('Authorization', 'Bearer tok')
        .send({
          items: [{ feedingRecordItemId: 'item-1', quantityLeftoverKg: 8 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.totalLeftoverKg).toBe(8);
      expect(res.body.totalConsumedKg).toBe(142);
      expect(res.body.leftoverPercent).toBe(5.33);
      expect(res.body.consumptionPerAnimalKg).toBe(4.733);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should detect excess leftover alert', async () => {
      const excessLeftovers: FeedingRecordResponse = {
        ...SAMPLE_RECORD,
        totalLeftoverKg: 25,
        totalConsumedKg: 125,
        leftoverPercent: 16.67,
        leftoverAlert: true,
        leftoverAlertType: 'EXCESS',
        leftoverAlertLabel: 'Excesso (>10%) — possível problema de palatabilidade',
        consumptionPerAnimalKg: 4.167,
      };
      mockedService.recordLeftovers.mockResolvedValue(excessLeftovers);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/feeding-records/feed-1/leftovers')
        .set('Authorization', 'Bearer tok')
        .send({ items: [{ feedingRecordItemId: 'item-1', quantityLeftoverKg: 25 }] });

      expect(res.status).toBe(200);
      expect(res.body.leftoverAlert).toBe(true);
      expect(res.body.leftoverAlertType).toBe('EXCESS');
    });

    it('should detect restriction alert when zero leftover', async () => {
      const zeroLeftovers: FeedingRecordResponse = {
        ...SAMPLE_RECORD,
        totalLeftoverKg: 0,
        totalConsumedKg: 150,
        leftoverPercent: 0,
        leftoverAlert: true,
        leftoverAlertType: 'RESTRICTION',
        leftoverAlertLabel: 'Restrição (0%) — possível falta de alimento',
        consumptionPerAnimalKg: 5,
      };
      mockedService.recordLeftovers.mockResolvedValue(zeroLeftovers);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/feeding-records/feed-1/leftovers')
        .set('Authorization', 'Bearer tok')
        .send({ items: [{ feedingRecordItemId: 'item-1', quantityLeftoverKg: 0 }] });

      expect(res.status).toBe(200);
      expect(res.body.leftoverAlert).toBe(true);
      expect(res.body.leftoverAlertType).toBe('RESTRICTION');
    });
  });

  // ─── DELETE ──────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/feeding-records/:feedingId', () => {
    it('should delete and return success message', async () => {
      mockedService.deleteFeedingRecord.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/feeding-records/feed-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Registro de trato excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deleteFeedingRecord.mockRejectedValue(
        new FeedingRecordError('Registro de trato não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/feeding-records/nope')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/feeding-records/feed-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── INDICATORS (CA7) ────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/feeding-records/indicators', () => {
    const sampleIndicators: ConsumptionIndicators = {
      period: { from: '2026-02-15', to: '2026-03-15' },
      lotId: 'lot-1',
      lotName: 'Lote Vacas Lactação',
      averageDmPerAnimalDay: 12.5,
      plannedDmPerAnimalDay: 13.0,
      dmVariancePercent: -3.85,
      costPerAnimalDay: 8.5,
      costPerLiterMilk: 0.35,
      consumptionEvolution: [
        {
          date: '2026-03-14',
          totalProvidedKg: 150,
          totalConsumedKg: 142,
          animalCount: 30,
          consumptionPerAnimalKg: 4.733,
        },
        {
          date: '2026-03-15',
          totalProvidedKg: 155,
          totalConsumedKg: 148,
          animalCount: 30,
          consumptionPerAnimalKg: 4.933,
        },
      ],
    };

    it('should return consumption indicators', async () => {
      mockedService.getConsumptionIndicators.mockResolvedValue(sampleIndicators);

      const res = await request(app)
        .get('/api/org/farms/farm-1/feeding-records/indicators?lotId=lot-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.averageDmPerAnimalDay).toBe(12.5);
      expect(res.body.plannedDmPerAnimalDay).toBe(13.0);
      expect(res.body.dmVariancePercent).toBe(-3.85);
      expect(res.body.costPerAnimalDay).toBe(8.5);
      expect(res.body.costPerLiterMilk).toBe(0.35);
      expect(res.body.consumptionEvolution).toHaveLength(2);
    });
  });

  // ─── EXPORT CSV ──────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/feeding-records/export', () => {
    it('should return CSV', async () => {
      const csv = 'Data,Turno,Lote\n2026-03-15,Manhã,"Lote 1"';
      mockedService.exportFeedingsCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/feeding-records/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Lote 1');
    });
  });

  // ─── 500 ERRORS ──────────────────────────────────────────────────

  describe('Error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockedService.listFeedingRecords.mockRejectedValue(new Error('DB down'));

      const res = await request(app)
        .get('/api/org/farms/farm-1/feeding-records')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });
  });
});
