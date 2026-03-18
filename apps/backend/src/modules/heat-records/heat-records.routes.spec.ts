import request from 'supertest';
import { app } from '../../app';
import * as heatRecordsService from './heat-records.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  HeatRecordError,
  type HeatRecordItem,
  type DailyHeatItem,
  type HeatIndicators,
} from './heat-records.types';

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

jest.mock('./heat-records.service', () => ({
  createHeat: jest.fn(),
  listHeats: jest.fn(),
  getHeat: jest.fn(),
  updateHeat: jest.fn(),
  deleteHeat: jest.fn(),
  getDailyHeats: jest.fn(),
  getHeatHistory: jest.fn(),
  getHeatIndicators: jest.fn(),
  exportHeatsCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(heatRecordsService);
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

const SAMPLE_HEAT: HeatRecordItem = {
  id: 'heat-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  heatDate: '2026-03-14',
  heatTime: '08:30',
  heatPeriod: null,
  heatPeriodLabel: null,
  intensity: 'STRONG',
  intensityLabel: 'Forte',
  signs: ['mount_accepted', 'mucus'],
  signLabels: ['Aceita monta', 'Muco'],
  detectionMethod: 'VISUAL',
  detectionMethodLabel: 'Visual',
  status: 'AWAITING_AI',
  statusLabel: 'Aguardando IA',
  recommendedAiTime: '2026-03-14T18:30:00.000Z',
  recommendedBullId: null,
  cyclicityStatus: null,
  cyclicityStatusLabel: null,
  previousHeatDate: '2026-02-22',
  interHeatDays: 20,
  isIntervalIrregular: false,
  inseminationId: null,
  notInseminatedReason: null,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_DAILY: DailyHeatItem = {
  awaitingAi: [SAMPLE_HEAT],
  aiDone: [],
  notInseminated: [],
  total: 1,
  date: '2026-03-14',
};

const SAMPLE_INDICATORS: HeatIndicators = {
  totalHeatsDetected: 25,
  avgInterHeatDays: 21.3,
  irregularIntervalPercent: 12.5,
  heatsInseminatedPercent: 80.0,
  conceptionRatePlaceholder: null,
  detectionRateMonthly: 8.3,
  periodStart: '2025-12-14',
  periodEnd: '2026-03-14',
};

describe('HeatRecords routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1) ──────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/heat-records', () => {
    const validInput = {
      animalId: 'animal-1',
      heatDate: '2026-03-14',
      heatTime: '08:30',
      intensity: 'STRONG',
      signs: ['mount_accepted', 'mucus'],
      detectionMethod: 'VISUAL',
    };

    it('deve criar registro de cio e retornar 201', async () => {
      mockedService.createHeat.mockResolvedValue(SAMPLE_HEAT);

      const res = await request(app)
        .post('/api/org/farms/farm-1/heat-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('heat-1');
      expect(res.body.intensity).toBe('STRONG');
      expect(res.body.signs).toEqual(['mount_accepted', 'mucus']);
      expect(mockedService.createHeat).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando animal não encontrado', async () => {
      mockedService.createHeat.mockRejectedValue(new HeatRecordError('Animal não encontrado', 404));

      const res = await request(app)
        .post('/api/org/farms/farm-1/heat-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Animal não encontrado');
    });

    it('deve retornar 400 para animal macho', async () => {
      mockedService.createHeat.mockRejectedValue(
        new HeatRecordError('Registro de cio é permitido apenas para fêmeas', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/heat-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Registro de cio é permitido apenas para fêmeas');
    });

    it('deve retornar 400 para animal sem liberação reprodutiva', async () => {
      mockedService.createHeat.mockRejectedValue(
        new HeatRecordError('Animal não possui liberação reprodutiva', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/heat-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Animal não possui liberação reprodutiva');
    });

    it('deve negar acesso ao OPERATOR sem animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/heat-records')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });

    it('deve retornar 400 para campos obrigatórios ausentes', async () => {
      mockedService.createHeat.mockRejectedValue(new HeatRecordError('Animal é obrigatório', 400));

      const res = await request(app)
        .post('/api/org/farms/farm-1/heat-records')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/heat-records', () => {
    it('deve listar registros de cio com paginação', async () => {
      mockedService.listHeats.mockResolvedValue({
        data: [SAMPLE_HEAT],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('deve filtrar por animalId', async () => {
      mockedService.listHeats.mockResolvedValue({ data: [], total: 0 });

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records?animalId=animal-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockedService.listHeats).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ animalId: 'animal-1' }),
      );
    });

    it('deve filtrar por intervalo de datas', async () => {
      mockedService.listHeats.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/heat-records?dateFrom=2026-01-01&dateTo=2026-03-31')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listHeats).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ dateFrom: '2026-01-01', dateTo: '2026-03-31' }),
      );
    });

    it('deve filtrar por status', async () => {
      mockedService.listHeats.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/heat-records?status=AWAITING_AI')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listHeats).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ status: 'AWAITING_AI' }),
      );
    });
  });

  // ─── GET ───────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/heat-records/:heatId', () => {
    it('deve retornar registro de cio por id', async () => {
      mockedService.getHeat.mockResolvedValue(SAMPLE_HEAT);

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records/heat-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('heat-1');
      expect(res.body.recommendedAiTime).toBe('2026-03-14T18:30:00.000Z');
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.getHeat.mockRejectedValue(
        new HeatRecordError('Registro de cio não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/heat-records/:heatId', () => {
    it('deve atualizar status do registro de cio', async () => {
      const updated = { ...SAMPLE_HEAT, status: 'AI_DONE' as const, statusLabel: 'IA realizada' };
      mockedService.updateHeat.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/heat-records/heat-1')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'AI_DONE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('AI_DONE');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve atualizar ciclicidade (CA7)', async () => {
      const updated = {
        ...SAMPLE_HEAT,
        cyclicityStatus: 'CYCLING',
        cyclicityStatusLabel: 'Ciclando',
      };
      mockedService.updateHeat.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/heat-records/heat-1')
        .set('Authorization', 'Bearer tok')
        .send({ cyclicityStatus: 'CYCLING' });

      expect(res.status).toBe(200);
      expect(res.body.cyclicityStatus).toBe('CYCLING');
      expect(res.body.cyclicityStatusLabel).toBe('Ciclando');
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.updateHeat.mockRejectedValue(
        new HeatRecordError('Registro de cio não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/heat-records/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'AI_DONE' });

      expect(res.status).toBe(404);
    });

    it('deve marcar como não inseminada com motivo', async () => {
      const updated = {
        ...SAMPLE_HEAT,
        status: 'NOT_INSEMINATED' as const,
        statusLabel: 'Não inseminada',
        notInseminatedReason: 'Sêmen indisponível',
      };
      mockedService.updateHeat.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/heat-records/heat-1')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'NOT_INSEMINATED', notInseminatedReason: 'Sêmen indisponível' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('NOT_INSEMINATED');
      expect(res.body.notInseminatedReason).toBe('Sêmen indisponível');
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/heat-records/:heatId', () => {
    it('deve excluir registro de cio', async () => {
      mockedService.deleteHeat.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/heat-records/heat-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Registro de cio excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.deleteHeat.mockRejectedValue(
        new HeatRecordError('Registro de cio não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/heat-records/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('deve negar OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/heat-records/heat-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── DAILY HEATS (CA5) ────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/heat-records/daily', () => {
    it('deve retornar cios do dia agrupados por status', async () => {
      mockedService.getDailyHeats.mockResolvedValue(SAMPLE_DAILY);

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records/daily')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.awaitingAi).toHaveLength(1);
      expect(res.body.aiDone).toHaveLength(0);
      expect(res.body.notInseminated).toHaveLength(0);
      expect(res.body.total).toBe(1);
      expect(res.body.date).toBe('2026-03-14');
    });

    it('deve aceitar parâmetro de data', async () => {
      mockedService.getDailyHeats.mockResolvedValue({ ...SAMPLE_DAILY, date: '2026-03-13' });

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records/daily?date=2026-03-13')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockedService.getDailyHeats).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        '2026-03-13',
      );
    });
  });

  // ─── HEAT HISTORY (CA4) ───────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/heat-records/history/:animalId', () => {
    it('deve retornar histórico de cios do animal com intervalo médio', async () => {
      mockedService.getHeatHistory.mockResolvedValue({
        data: [SAMPLE_HEAT],
        total: 1,
        avgInterHeatDays: 20,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records/history/animal-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.avgInterHeatDays).toBe(20);
      expect(res.body.data[0].interHeatDays).toBe(20);
      expect(res.body.data[0].isIntervalIrregular).toBe(false);
    });

    it('deve retornar 404 para animal inexistente', async () => {
      mockedService.getHeatHistory.mockRejectedValue(
        new HeatRecordError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records/history/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── INDICATORS (CA6) ─────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/heat-records/indicators', () => {
    it('deve retornar indicadores de detecção de cio', async () => {
      mockedService.getHeatIndicators.mockResolvedValue(SAMPLE_INDICATORS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records/indicators')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalHeatsDetected).toBe(25);
      expect(res.body.avgInterHeatDays).toBe(21.3);
      expect(res.body.irregularIntervalPercent).toBe(12.5);
      expect(res.body.heatsInseminatedPercent).toBe(80.0);
      expect(res.body.conceptionRatePlaceholder).toBeNull();
      expect(res.body.detectionRateMonthly).toBe(8.3);
    });
  });

  // ─── EXPORT CSV ───────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/heat-records/export', () => {
    it('deve retornar CSV com headers corretos', async () => {
      const csv = '\uFEFFRELATÓRIO DE DETECÇÃO DE CIO\nBrinco;Nome;Data';
      mockedService.exportHeatsCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/heat-records/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('cios-');
      expect(res.text).toContain('RELATÓRIO DE DETECÇÃO DE CIO');
    });

    it('deve aceitar filtros na exportação', async () => {
      mockedService.exportHeatsCsv.mockResolvedValue('\uFEFF');

      await request(app)
        .get('/api/org/farms/farm-1/heat-records/export?animalId=animal-1&status=AWAITING_AI')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.exportHeatsCsv).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ animalId: 'animal-1', status: 'AWAITING_AI' }),
      );
    });
  });
});
