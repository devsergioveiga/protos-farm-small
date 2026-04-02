import request from 'supertest';
import { app } from '../../app';
import * as bullsService from './bulls.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  BullError,
  type BullItem,
  type BullWithBatches,
  type SemenBatchItem,
  type BullCatalogItem,
  type ImportBullsResult,
} from './bulls.types';

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

jest.mock('./bulls.service', () => ({
  createBull: jest.fn(),
  listBulls: jest.fn(),
  getBull: jest.fn(),
  updateBull: jest.fn(),
  deleteBull: jest.fn(),
  createSemenBatch: jest.fn(),
  updateSemenBatch: jest.fn(),
  useSemen: jest.fn(),
  getBullCatalog: jest.fn(),
  getBullUsageHistory: jest.fn(),
  importBullsCsv: jest.fn(),
  exportBullsCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(bullsService);
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

const SAMPLE_BULL: BullItem = {
  id: 'bull-1',
  organizationId: 'org-1',
  farmId: 'farm-1',
  name: 'Guardião FIV',
  registryNumber: 'ABCZ-12345',
  registryAssociation: 'ABCZ',
  breedName: 'Nelore',
  breedComposition: [{ breed: 'Nelore', percentage: 100 }],
  isOwnAnimal: false,
  animalId: null,
  animalEarTag: null,
  ownerName: 'João Pecuarista',
  ownerContact: '(11) 99999-0000',
  stayStartDate: '2026-01-01',
  stayEndDate: '2026-12-31',
  status: 'ACTIVE',
  statusLabel: 'Ativo',
  ptaMilkKg: 850,
  ptaFatKg: 35,
  ptaFatPct: 0.12,
  ptaProteinKg: 28,
  ptaProteinPct: 0.08,
  typeScore: 1.5,
  productiveLife: 4.2,
  calvingEase: 7.5,
  scc: 2.8,
  geneticProofs: [{ proofName: 'TPI', value: 2800, reliability: 99 }],
  photoUrl: null,
  notes: null,
  semenStock: 50,
  deletedAt: null,
  createdAt: '2026-03-14T10:00:00.000Z',
  updatedAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_SEMEN_BATCH: SemenBatchItem = {
  id: 'batch-1',
  organizationId: 'org-1',
  bullId: 'bull-1',
  batchNumber: 'LOT-2026-001',
  centralName: 'CRV Lagoa',
  entryType: 'PURCHASE',
  entryTypeLabel: 'Compra',
  semenType: 'SEXED_FEMALE' as const,
  semenTypeLabel: 'Sexado fêmea',
  entryDate: '2026-03-01',
  expiryDate: '2028-03-01',
  initialDoses: 50,
  currentDoses: 50,
  costPerDose: 3500,
  notes: null,
  createdAt: '2026-03-14T10:00:00.000Z',
  updatedAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_BULL_WITH_BATCHES: BullWithBatches = {
  ...SAMPLE_BULL,
  semenBatches: [SAMPLE_SEMEN_BATCH],
};

describe('Bulls routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/bulls', () => {
    const validInput = {
      name: 'Guardião FIV',
      breedName: 'Nelore',
      breedComposition: [{ breed: 'Nelore', percentage: 100 }],
      ptaMilkKg: 850,
    };

    it('should create bull and return 201', async () => {
      mockedService.createBull.mockResolvedValue(SAMPLE_BULL);

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('bull-1');
      expect(res.body.name).toBe('Guardião FIV');
      expect(mockedService.createBull).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing name', async () => {
      mockedService.createBull.mockRejectedValue(new BullError('Nome do touro é obrigatório', 400));

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls')
        .set('Authorization', 'Bearer tok')
        .send({ breedName: 'Nelore' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Nome do touro é obrigatório');
    });

    it('should return 409 for duplicate name', async () => {
      mockedService.createBull.mockRejectedValue(
        new BullError('Já existe um touro com este nome na organização', 409),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(409);
    });

    it('should deny OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST ────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/bulls', () => {
    it('should list bulls with pagination', async () => {
      mockedService.listBulls.mockResolvedValue({
        data: [SAMPLE_BULL],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/bulls')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockedService.listBulls.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/bulls?status=ACTIVE')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listBulls).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ status: 'ACTIVE' }),
      );
    });

    it('should filter by search', async () => {
      mockedService.listBulls.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/bulls?search=Guardião')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listBulls).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ search: 'Guardião' }),
      );
    });
  });

  // ─── GET ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/bulls/:bullId', () => {
    it('should return bull with semen batches', async () => {
      mockedService.getBull.mockResolvedValue(SAMPLE_BULL_WITH_BATCHES);

      const res = await request(app)
        .get('/api/org/farms/farm-1/bulls/bull-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('bull-1');
      expect(res.body.semenBatches).toHaveLength(1);
      expect(res.body.semenBatches[0].batchNumber).toBe('LOT-2026-001');
    });

    it('should return 404 when not found', async () => {
      mockedService.getBull.mockRejectedValue(new BullError('Touro não encontrado', 404));

      const res = await request(app)
        .get('/api/org/farms/farm-1/bulls/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/bulls/:bullId', () => {
    it('should update bull fields', async () => {
      const updated = { ...SAMPLE_BULL, status: 'RESTING' as const, statusLabel: 'Em descanso' };
      mockedService.updateBull.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/bulls/bull-1')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'RESTING' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RESTING');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.updateBull.mockRejectedValue(new BullError('Touro não encontrado', 404));

      const res = await request(app)
        .patch('/api/org/farms/farm-1/bulls/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'RESTING' });

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/bulls/bull-1')
        .set('Authorization', 'Bearer tok')
        .send({ status: 'RESTING' });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE ──────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/bulls/:bullId', () => {
    it('should soft delete bull', async () => {
      mockedService.deleteBull.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/bulls/bull-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Touro excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deleteBull.mockRejectedValue(new BullError('Touro não encontrado', 404));

      const res = await request(app)
        .delete('/api/org/farms/farm-1/bulls/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/bulls/bull-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── CREATE SEMEN BATCH (CA4) ────────────────────────────────────

  describe('POST /api/org/farms/:farmId/bulls/:bullId/semen-batches', () => {
    const validBatchInput = {
      batchNumber: 'LOT-2026-001',
      centralName: 'CRV Lagoa',
      entryType: 'PURCHASE',
      entryDate: '2026-03-01',
      expiryDate: '2028-03-01',
      initialDoses: 50,
      costPerDose: 3500,
    };

    it('should create semen batch and return 201', async () => {
      mockedService.createSemenBatch.mockResolvedValue(SAMPLE_SEMEN_BATCH);

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls/bull-1/semen-batches')
        .set('Authorization', 'Bearer tok')
        .send(validBatchInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('batch-1');
      expect(res.body.batchNumber).toBe('LOT-2026-001');
      expect(res.body.initialDoses).toBe(50);
      expect(res.body.currentDoses).toBe(50);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing batch number', async () => {
      mockedService.createSemenBatch.mockRejectedValue(
        new BullError('Número do lote é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls/bull-1/semen-batches')
        .set('Authorization', 'Bearer tok')
        .send({ entryDate: '2026-03-01', initialDoses: 50 });

      expect(res.status).toBe(400);
    });

    it('should return 404 when bull not found', async () => {
      mockedService.createSemenBatch.mockRejectedValue(new BullError('Touro não encontrado', 404));

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls/unknown/semen-batches')
        .set('Authorization', 'Bearer tok')
        .send(validBatchInput);

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE SEMEN BATCH ─────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/bulls/semen-batches/:batchId', () => {
    it('should update semen batch', async () => {
      const updated = { ...SAMPLE_SEMEN_BATCH, costPerDose: 4000 };
      mockedService.updateSemenBatch.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/bulls/semen-batches/batch-1')
        .set('Authorization', 'Bearer tok')
        .send({ costPerDose: 4000 });

      expect(res.status).toBe(200);
      expect(res.body.costPerDose).toBe(4000);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when batch not found', async () => {
      mockedService.updateSemenBatch.mockRejectedValue(
        new BullError('Lote de sêmen não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/bulls/semen-batches/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ costPerDose: 4000 });

      expect(res.status).toBe(404);
    });
  });

  // ─── USE SEMEN (CA4) ────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/bulls/semen-batches/:batchId/use', () => {
    it('should deduct doses and return updated batch', async () => {
      const updated = { ...SAMPLE_SEMEN_BATCH, currentDoses: 45 };
      mockedService.useSemen.mockResolvedValue(updated);

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls/semen-batches/batch-1/use')
        .set('Authorization', 'Bearer tok')
        .send({ dosesUsed: 5 });

      expect(res.status).toBe(200);
      expect(res.body.currentDoses).toBe(45);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 when insufficient doses', async () => {
      mockedService.useSemen.mockRejectedValue(
        new BullError('Doses insuficientes. Disponível: 5, solicitado: 10', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls/semen-batches/batch-1/use')
        .set('Authorization', 'Bearer tok')
        .send({ dosesUsed: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Doses insuficientes');
    });

    it('should return 404 when batch not found', async () => {
      mockedService.useSemen.mockRejectedValue(new BullError('Lote de sêmen não encontrado', 404));

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls/semen-batches/unknown/use')
        .set('Authorization', 'Bearer tok')
        .send({ dosesUsed: 5 });

      expect(res.status).toBe(404);
    });
  });

  // ─── CATALOG (CA5) ──────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/bulls/catalog', () => {
    const SAMPLE_CATALOG_ITEM: BullCatalogItem = {
      id: 'bull-1',
      name: 'Guardião FIV',
      breedName: 'Nelore',
      registryNumber: 'ABCZ-12345',
      registryAssociation: 'ABCZ',
      status: 'ACTIVE',
      statusLabel: 'Ativo',
      ptaMilkKg: 850,
      ptaFatKg: 35,
      ptaFatPct: 0.12,
      ptaProteinKg: 28,
      ptaProteinPct: 0.08,
      typeScore: 1.5,
      productiveLife: 4.2,
      calvingEase: 7.5,
      scc: 2.8,
      semenStock: 50,
      farmId: 'farm-1',
    };

    it('should return catalog ranked by PTA Milk', async () => {
      mockedService.getBullCatalog.mockResolvedValue({
        data: [SAMPLE_CATALOG_ITEM],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/bulls/catalog')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].ptaMilkKg).toBe(850);
    });

    it('should filter by search', async () => {
      mockedService.getBullCatalog.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/bulls/catalog?search=Nelore')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getBullCatalog).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ search: 'Nelore' }),
      );
    });
  });

  // ─── EXPORT CSV ─────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/bulls/export', () => {
    it('should return CSV with correct headers', async () => {
      const csv = '\uFEFFNome;Raça;Registro\nGuardião FIV;Nelore;ABCZ-12345';
      mockedService.exportBullsCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/bulls/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('touros.csv');
      expect(res.text).toContain('Guardião FIV');
    });
  });

  // ─── IMPORT CSV (CA7) ──────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/bulls/import', () => {
    it('should import bulls from CSV', async () => {
      const importResult: ImportBullsResult = {
        imported: 3,
        skipped: 1,
        errors: ['Linha 5: Touro "Dup" já existe, ignorado'],
      };
      mockedService.importBullsCsv.mockResolvedValue(importResult);

      const csvContent = 'nome;raça;pta_leite\nTouro 1;Nelore;800';
      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls/import')
        .set('Authorization', 'Bearer tok')
        .attach('file', Buffer.from(csvContent), 'touros.csv');

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(3);
      expect(res.body.skipped).toBe(1);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 when no file provided', async () => {
      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls/import')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Arquivo é obrigatório');
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/bulls/import')
        .set('Authorization', 'Bearer tok')
        .attach('file', Buffer.from('test'), 'touros.csv');

      expect(res.status).toBe(403);
    });
  });

  // ─── USAGE HISTORY (CA6) ────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/bulls/:bullId/usage-history', () => {
    it('should return empty array (placeholder)', async () => {
      mockedService.getBullUsageHistory.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/org/farms/farm-1/bulls/bull-1/usage-history')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── AUTH ────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should return 401 without token', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).get('/api/org/farms/farm-1/bulls');

      expect(res.status).toBe(401);
    });
  });
});
