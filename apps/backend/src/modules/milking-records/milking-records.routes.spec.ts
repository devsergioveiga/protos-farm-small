import request from 'supertest';
import { app } from '../../app';
import * as milkingService from './milking-records.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  MilkingRecordError,
  type MilkingRecordItem,
  type BulkMilkingResult,
  type DailyProductionSummary,
  type ProductionTrendItem,
  type LactatingAnimalItem,
} from './milking-records.types';

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

jest.mock('./milking-records.service', () => ({
  createMilking: jest.fn(),
  bulkCreateMilkings: jest.fn(),
  listMilkings: jest.fn(),
  getMilking: jest.fn(),
  updateMilking: jest.fn(),
  deleteMilking: jest.fn(),
  getDailySummary: jest.fn(),
  getLactatingAnimals: jest.fn(),
  getProductionTrend: jest.fn(),
  exportMilkingsCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(milkingService);
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

const SAMPLE_MILKING: MilkingRecordItem = {
  id: 'milk-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  animalCategory: 'VACA_LACTACAO',
  lotName: 'Lote 1',
  milkingDate: '2026-03-14',
  shift: 'MORNING',
  shiftLabel: 'Manhã',
  liters: 12.5,
  variationPercent: null,
  variationAlert: false,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-14T06:00:00.000Z',
};

const SAMPLE_BULK_RESULT: BulkMilkingResult = {
  created: 5,
  alerts: [],
};

const SAMPLE_DAILY_SUMMARY: DailyProductionSummary = {
  date: '2026-03-14',
  totalLiters: 125.5,
  avgPerAnimal: 12.55,
  animalCount: 10,
  byShift: [
    { shift: 'MORNING', shiftLabel: 'Manhã', totalLiters: 75.0, animalCount: 10 },
    { shift: 'AFTERNOON', shiftLabel: 'Tarde', totalLiters: 50.5, animalCount: 10 },
  ],
  byLot: [
    { lotId: 'lot-1', lotName: 'Lote 1', totalLiters: 80.0, animalCount: 6 },
    { lotId: 'lot-2', lotName: 'Lote 2', totalLiters: 45.5, animalCount: 4 },
  ],
};

const SAMPLE_TREND: ProductionTrendItem[] = [
  { date: '2026-03-13', totalLiters: 120.0, animalCount: 10, avgPerAnimal: 12.0 },
  { date: '2026-03-14', totalLiters: 125.5, animalCount: 10, avgPerAnimal: 12.55 },
];

const SAMPLE_LACTATING: LactatingAnimalItem[] = [
  {
    id: 'animal-1',
    earTag: '001',
    name: 'Mimosa',
    category: 'VACA_LACTACAO',
    lotId: 'lot-1',
    lotName: 'Lote 1',
    lastMilkingDate: '2026-03-14',
    lastMilkingLiters: 12.5,
  },
];

describe('Milking records routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1) ──────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/milking-records', () => {
    const validInput = {
      animalId: 'animal-1',
      milkingDate: '2026-03-14',
      shift: 'MORNING',
      liters: 12.5,
    };

    it('should create milking record and return 201', async () => {
      mockedService.createMilking.mockResolvedValue(SAMPLE_MILKING);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milking-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('milk-1');
      expect(res.body.liters).toBe(12.5);
      expect(res.body.shift).toBe('MORNING');
      expect(mockedService.createMilking).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when animal not found', async () => {
      mockedService.createMilking.mockRejectedValue(
        new MilkingRecordError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milking-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Animal não encontrado');
    });

    it('should return 400 when animal is dry cow', async () => {
      mockedService.createMilking.mockRejectedValue(
        new MilkingRecordError(
          'Animal 001 está classificado como vaca seca e não pode ser ordenhado',
          400,
        ),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milking-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('vaca seca');
    });

    it('should deny access to OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milking-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── BULK CREATE (CA2) ────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/milking-records/bulk', () => {
    const validBulkInput = {
      milkingDate: '2026-03-14',
      shift: 'MORNING',
      entries: [
        { animalId: 'animal-1', liters: 12.5 },
        { animalId: 'animal-2', liters: 10.0 },
      ],
    };

    it('should bulk create milking records and return 201', async () => {
      mockedService.bulkCreateMilkings.mockResolvedValue(SAMPLE_BULK_RESULT);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milking-records/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(5);
      expect(res.body.alerts).toEqual([]);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return variation alerts when >30%', async () => {
      const resultWithAlerts: BulkMilkingResult = {
        created: 2,
        alerts: [
          {
            animalId: 'animal-1',
            animalEarTag: '001',
            liters: 20.0,
            previousLiters: 12.5,
            variationPercent: 60.0,
          },
        ],
      };
      mockedService.bulkCreateMilkings.mockResolvedValue(resultWithAlerts);

      const res = await request(app)
        .post('/api/org/farms/farm-1/milking-records/bulk')
        .set('Authorization', 'Bearer tok')
        .send(validBulkInput);

      expect(res.status).toBe(201);
      expect(res.body.alerts).toHaveLength(1);
      expect(res.body.alerts[0].variationPercent).toBe(60.0);
    });

    it('should return 400 for missing entries', async () => {
      mockedService.bulkCreateMilkings.mockRejectedValue(
        new MilkingRecordError('Pelo menos uma entrada é obrigatória', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/milking-records/bulk')
        .set('Authorization', 'Bearer tok')
        .send({ milkingDate: '2026-03-14', shift: 'MORNING', entries: [] });

      expect(res.status).toBe(400);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milking-records', () => {
    it('should list milking records with pagination', async () => {
      mockedService.listMilkings.mockResolvedValue({
        data: [SAMPLE_MILKING],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/milking-records')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by animalId and shift', async () => {
      mockedService.listMilkings.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/milking-records?animalId=animal-1&shift=MORNING')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listMilkings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ animalId: 'animal-1', shift: 'MORNING' }),
      );
    });

    it('should filter by date range', async () => {
      mockedService.listMilkings.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/milking-records?dateFrom=2026-03-01&dateTo=2026-03-31')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listMilkings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ dateFrom: '2026-03-01', dateTo: '2026-03-31' }),
      );
    });

    it('should filter by variationAlert', async () => {
      mockedService.listMilkings.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/milking-records?variationAlert=true')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listMilkings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ variationAlert: true }),
      );
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milking-records/:milkingId', () => {
    it('should return milking record by id', async () => {
      mockedService.getMilking.mockResolvedValue(SAMPLE_MILKING);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milking-records/milk-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('milk-1');
      expect(res.body.shiftLabel).toBe('Manhã');
    });

    it('should return 404 when not found', async () => {
      mockedService.getMilking.mockRejectedValue(
        new MilkingRecordError('Registro de ordenha não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/milking-records/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/milking-records/:milkingId', () => {
    it('should update liters and recalc variation', async () => {
      const updated = {
        ...SAMPLE_MILKING,
        liters: 15.0,
        variationPercent: 20.0,
        variationAlert: false,
      };
      mockedService.updateMilking.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/milking-records/milk-1')
        .set('Authorization', 'Bearer tok')
        .send({ liters: 15.0 });

      expect(res.status).toBe(200);
      expect(res.body.liters).toBe(15.0);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.updateMilking.mockRejectedValue(
        new MilkingRecordError('Registro de ordenha não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/milking-records/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ liters: 15.0 });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/milking-records/:milkingId', () => {
    it('should delete milking record', async () => {
      mockedService.deleteMilking.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milking-records/milk-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Registro de ordenha excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deleteMilking.mockRejectedValue(
        new MilkingRecordError('Registro de ordenha não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milking-records/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/milking-records/milk-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── DAILY SUMMARY (CA3) ─────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milking-records/daily-summary', () => {
    it('should return daily production summary', async () => {
      mockedService.getDailySummary.mockResolvedValue(SAMPLE_DAILY_SUMMARY);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milking-records/daily-summary')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalLiters).toBe(125.5);
      expect(res.body.animalCount).toBe(10);
      expect(res.body.byShift).toHaveLength(2);
      expect(res.body.byLot).toHaveLength(2);
    });

    it('should accept date query param', async () => {
      mockedService.getDailySummary.mockResolvedValue(SAMPLE_DAILY_SUMMARY);

      await request(app)
        .get('/api/org/farms/farm-1/milking-records/daily-summary?date=2026-03-14')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getDailySummary).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        '2026-03-14',
      );
    });
  });

  // ─── LACTATING ANIMALS (CA7) ─────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milking-records/lactating-animals', () => {
    it('should return list of lactating animals', async () => {
      mockedService.getLactatingAnimals.mockResolvedValue(SAMPLE_LACTATING);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milking-records/lactating-animals')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].earTag).toBe('001');
      expect(res.body[0].category).toBe('VACA_LACTACAO');
    });
  });

  // ─── PRODUCTION TREND ────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milking-records/trend', () => {
    it('should return production trend', async () => {
      mockedService.getProductionTrend.mockResolvedValue(SAMPLE_TREND);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milking-records/trend')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[1].totalLiters).toBe(125.5);
    });

    it('should accept days query param', async () => {
      mockedService.getProductionTrend.mockResolvedValue(SAMPLE_TREND);

      await request(app)
        .get('/api/org/farms/farm-1/milking-records/trend?days=7')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getProductionTrend).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        7,
      );
    });
  });

  // ─── EXPORT CSV ──────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/milking-records/export', () => {
    it('should return CSV with correct headers', async () => {
      const csv = '\uFEFFRELATÓRIO DE ORDENHA\nData;Turno;Brinco';
      mockedService.exportMilkingsCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/milking-records/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('ordenha-');
      expect(res.text).toContain('RELATÓRIO DE ORDENHA');
    });

    it('should pass filter params to export', async () => {
      mockedService.exportMilkingsCsv.mockResolvedValue('\uFEFF');

      await request(app)
        .get('/api/org/farms/farm-1/milking-records/export?dateFrom=2026-03-01&shift=MORNING')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.exportMilkingsCsv).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ dateFrom: '2026-03-01', shift: 'MORNING' }),
      );
    });
  });
});
