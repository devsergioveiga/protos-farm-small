import request from 'supertest';
import { app } from '../../app';
import * as weaningService from './weaning.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { WeaningError, type WeaningItem } from './weaning.types';

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

jest.mock('./weaning.service', () => ({
  getWeaningConfig: jest.fn(),
  setWeaningConfig: jest.fn(),
  getUnweanedAnimals: jest.fn(),
  createWeaning: jest.fn(),
  createBulkWeaning: jest.fn(),
  listWeanings: jest.fn(),
  getWeaning: jest.fn(),
  deleteWeaning: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(weaningService);
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

const SAMPLE_WEANING: WeaningItem = {
  id: 'wean-1',
  farmId: 'farm-1',
  calfId: 'calf-1',
  calfEarTag: '001-1',
  calfName: null,
  weaningDate: '2026-05-10',
  weightKg: 75,
  targetLotId: 'lot-recria',
  observations: 'Bezerro saudável',
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-05-10T10:00:00.000Z',
};

describe('Weaning routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE WEANING ─────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/weanings', () => {
    const validInput = {
      calfId: 'calf-1',
      weaningDate: '2026-05-10',
      weightKg: 75,
      targetLotId: 'lot-recria',
      observations: 'Bezerro saudável',
    };

    it('deve registrar desmame e retornar 201', async () => {
      mockedService.createWeaning.mockResolvedValue(SAMPLE_WEANING);

      const res = await request(app)
        .post('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('wean-1');
      expect(res.body.calfEarTag).toBe('001-1');
      expect(res.body.weightKg).toBe(75);
      expect(res.body.targetLotId).toBe('lot-recria');
      expect(mockedService.createWeaning).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando bezerro não encontrado', async () => {
      mockedService.createWeaning.mockRejectedValue(
        new WeaningError('Bezerro não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
    });

    it('deve retornar 409 para desmame duplicado', async () => {
      mockedService.createWeaning.mockRejectedValue(
        new WeaningError('Bezerro 001-1 já possui registro de desmame', 409),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('já possui registro de desmame');
    });

    it('deve negar acesso ao OPERATOR sem animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST WEANINGS ───────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/weanings', () => {
    it('deve listar desmames com paginação', async () => {
      mockedService.listWeanings.mockResolvedValue({
        data: [SAMPLE_WEANING],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('deve filtrar por intervalo de datas e busca', async () => {
      mockedService.listWeanings.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/weanings?dateFrom=2026-01-01&dateTo=2026-12-31&search=001')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listWeanings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({
          dateFrom: '2026-01-01',
          dateTo: '2026-12-31',
          search: '001',
        }),
      );
    });
  });

  // ─── GET WEANING ─────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/weanings/:weaningId', () => {
    it('deve retornar detalhe do desmame', async () => {
      mockedService.getWeaning.mockResolvedValue(SAMPLE_WEANING);

      const res = await request(app)
        .get('/api/org/farms/farm-1/weanings/wean-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('wean-1');
      expect(res.body.weightKg).toBe(75);
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.getWeaning.mockRejectedValue(
        new WeaningError('Registro de desmame não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/weanings/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE WEANING ──────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/weanings/:weaningId', () => {
    it('deve excluir desmame', async () => {
      mockedService.deleteWeaning.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/weanings/wean-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Registro de desmame excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.deleteWeaning.mockRejectedValue(
        new WeaningError('Registro de desmame não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/weanings/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('deve negar OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/weanings/wean-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── WEANING CONFIG ─────────────────────────────────────────────

  describe('GET /api/org/weaning-config', () => {
    it('deve retornar configuração de desmama', async () => {
      mockedService.getWeaningConfig.mockResolvedValue({
        weaningDaysMale: 210,
        weaningDaysFemale: 180,
        minWeightKgMale: 180,
        minWeightKgFemale: 160,
      });

      const res = await request(app)
        .get('/api/org/weaning-config')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.weaningDaysMale).toBe(210);
      expect(res.body.minWeightKgFemale).toBe(160);
    });
  });

  describe('PUT /api/org/weaning-config', () => {
    it('deve salvar configuração de desmama', async () => {
      mockedService.setWeaningConfig.mockResolvedValue({
        weaningDaysMale: 210,
        weaningDaysFemale: 180,
        minWeightKgMale: 180,
        minWeightKgFemale: 160,
      });

      const res = await request(app)
        .put('/api/org/weaning-config')
        .set('Authorization', 'Bearer tok')
        .send({ weaningDaysMale: 210, weaningDaysFemale: 180, minWeightKgMale: 180, minWeightKgFemale: 160 });

      expect(res.status).toBe(200);
      expect(res.body.weaningDaysMale).toBe(210);
    });

    it('deve negar OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .put('/api/org/weaning-config')
        .set('Authorization', 'Bearer tok')
        .send({ weaningDaysMale: 210 });

      expect(res.status).toBe(403);
    });
  });

  // ─── UNWEANED ANIMALS ──────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/weanings/unweaned', () => {
    it('deve retornar lista de animais não desmamados', async () => {
      mockedService.getUnweanedAnimals.mockResolvedValue([
        {
          id: 'calf-1',
          earTag: '001-1',
          name: null,
          sex: 'MALE',
          category: 'BEZERRO',
          birthDate: '2025-09-01',
          ageDays: 202,
          expectedWeaningDate: '2026-03-30',
          isOverdue: false,
          lastWeightKg: 165,
          lastWeighingDate: '2026-03-15',
          lotId: null,
          lotName: null,
        },
      ]);

      const res = await request(app)
        .get('/api/org/farms/farm-1/weanings/unweaned')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].earTag).toBe('001-1');
      expect(res.body[0].expectedWeaningDate).toBe('2026-03-30');
    });
  });

  // ─── BULK WEANING ──────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/weanings/bulk', () => {
    it('deve registrar desmame em lote e retornar 201', async () => {
      mockedService.createBulkWeaning.mockResolvedValue([
        { calfId: 'calf-1', calfEarTag: '001-1', status: 'created', weaningId: 'w-1', weightWarning: null },
        { calfId: 'calf-2', calfEarTag: '002-1', status: 'created', weaningId: 'w-2', weightWarning: 'Peso 150 kg abaixo do mínimo configurado (180 kg)' },
      ]);

      const res = await request(app)
        .post('/api/org/farms/farm-1/weanings/bulk')
        .set('Authorization', 'Bearer tok')
        .send({
          weaningDate: '2026-03-22',
          animals: [
            { calfId: 'calf-1', weightKg: 185 },
            { calfId: 'calf-2', weightKg: 150 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].status).toBe('created');
      expect(res.body[1].weightWarning).toContain('abaixo do mínimo');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });
});
