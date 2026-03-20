import request from 'supertest';
import { app } from '../../app';
import * as depreciationService from './depreciation.service';
import * as depreciationBatchService from './depreciation-batch.service';
import * as authService from '../auth/auth.service';
import { DepreciationError } from './depreciation.types';
import Decimal from 'decimal.js';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./depreciation.service', () => ({
  createConfig: jest.fn(),
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
  deleteConfig: jest.fn(),
  getReport: jest.fn(),
  exportReport: jest.fn(),
  getLastRun: jest.fn(),
}));

jest.mock('./depreciation-batch.service', () => ({
  runDepreciationBatch: jest.fn(),
  reverseEntry: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(depreciationService);
const mockedBatch = jest.mocked(depreciationBatchService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const BASE_CONFIG = {
  id: 'cfg-1',
  organizationId: ORG_ID,
  assetId: 'asset-1',
  method: 'STRAIGHT_LINE',
  fiscalAnnualRate: new Decimal('0.1'),
  managerialAnnualRate: null,
  usefulLifeMonths: 120,
  residualValue: new Decimal('25000.00'),
  totalHours: null,
  totalUnits: null,
  accelerationFactor: null,
  activeTrack: 'FISCAL',
  createdAt: new Date(),
  updatedAt: new Date(),
  asset: {
    id: 'asset-1',
    name: 'Trator',
    assetType: 'MAQUINA',
    assetTag: 'PAT-00001',
    classification: 'DEPRECIABLE_CPC27',
  },
};

const BASE_RUN = {
  id: 'run-1',
  organizationId: ORG_ID,
  periodYear: 2025,
  periodMonth: 1,
  track: 'FISCAL',
  status: 'COMPLETED',
  totalAssets: 1,
  processedCount: 1,
  skippedCount: 0,
  totalAmount: new Decimal('1875.00'),
  triggeredBy: 'admin-1',
  startedAt: new Date(),
  completedAt: new Date(),
  errorMessage: null,
};

const BASE_ENTRY = {
  id: 'entry-1',
  organizationId: ORG_ID,
  assetId: 'asset-1',
  runId: 'run-1',
  periodYear: 2025,
  periodMonth: 1,
  track: 'FISCAL',
  openingBookValue: new Decimal('225000.00'),
  depreciationAmount: new Decimal('1875.00'),
  closingBookValue: new Decimal('223125.00'),
  proRataDays: null,
  daysInMonth: 31,
  reversedAt: null,
  reversalEntryId: null,
  notes: null,
  createdAt: new Date(),
  asset: { id: 'asset-1', name: 'Trator', assetType: 'MAQUINA', assetTag: 'PAT-00001' },
  run: { id: 'run-1', triggeredBy: 'admin-1', startedAt: new Date() },
  ccItems: [],
};

describe('Depreciation Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/org/:orgId/depreciation/config', () => {
    it('creates config for depreciable asset → 201', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createConfig.mockResolvedValue(BASE_CONFIG as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/config`)
        .set('Authorization', 'Bearer token')
        .send({ assetId: 'asset-1', method: 'STRAIGHT_LINE', fiscalAnnualRate: 0.1 });

      expect(res.status).toBe(201);
      expect(res.body.assetId).toBe('asset-1');
    });

    it('rejects non-depreciable asset → 400', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createConfig.mockRejectedValue(
        new DepreciationError('Ativo nao depreciavel', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/config`)
        .set('Authorization', 'Bearer token')
        .send({ assetId: 'asset-land', method: 'STRAIGHT_LINE' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Ativo nao depreciavel');
    });

    it('rejects duplicate config → 409', async () => {
      authAs(ADMIN_PAYLOAD);
      const p2002Err = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      mockedService.createConfig.mockRejectedValue(p2002Err);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/config`)
        .set('Authorization', 'Bearer token')
        .send({ assetId: 'asset-1' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/org/:orgId/depreciation/config/:assetId', () => {
    it('returns config → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getConfig.mockResolvedValue(BASE_CONFIG as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/depreciation/config/asset-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.assetId).toBe('asset-1');
    });

    it('returns 404 when not found', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getConfig.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/depreciation/config/missing-asset`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/org/:orgId/depreciation/config/:assetId', () => {
    it('updates method and rates → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      const updated = {
        ...BASE_CONFIG,
        method: 'ACCELERATED',
        accelerationFactor: new Decimal('1.5'),
      };
      mockedService.updateConfig.mockResolvedValue(updated as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/depreciation/config/asset-1`)
        .set('Authorization', 'Bearer token')
        .send({ method: 'ACCELERATED', accelerationFactor: 1.5 });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/org/:orgId/depreciation/config/:assetId', () => {
    it('deletes config → 204', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteConfig.mockResolvedValue(BASE_CONFIG as never);

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/depreciation/config/asset-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
    });
  });

  describe('POST /api/org/:orgId/depreciation/run', () => {
    it('triggers batch for period → 202 with run record', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedBatch.runDepreciationBatch.mockResolvedValue(BASE_RUN as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/run`)
        .set('Authorization', 'Bearer token')
        .send({ periodYear: 2025, periodMonth: 1, track: 'FISCAL' });

      expect(res.status).toBe(202);
      expect(res.body.id).toBe('run-1');
    });

    it('rejects duplicate run without force → 409', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedBatch.runDepreciationBatch.mockRejectedValue(
        new DepreciationError('Depreciacao ja executada para este periodo', 409),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/run`)
        .set('Authorization', 'Bearer token')
        .send({ periodYear: 2025, periodMonth: 1, track: 'FISCAL' });

      expect(res.status).toBe(409);
    });

    it('allows force re-run → 202', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedBatch.runDepreciationBatch.mockResolvedValue({ ...BASE_RUN, id: 'run-2' } as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/run`)
        .set('Authorization', 'Bearer token')
        .send({ periodYear: 2025, periodMonth: 1, track: 'FISCAL', force: true });

      expect(res.status).toBe(202);
      expect(mockedBatch.runDepreciationBatch).toHaveBeenCalledWith(
        expect.objectContaining({ force: true }),
      );
    });
  });

  describe('POST /api/org/:orgId/depreciation/entries/:entryId/reverse', () => {
    it('creates reversal → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      const reversalEntry = {
        ...BASE_ENTRY,
        id: 'reversal-1',
        depreciationAmount: new Decimal('-1875.00'),
      };
      mockedBatch.reverseEntry.mockResolvedValue(reversalEntry as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/entries/entry-1/reverse`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });

    it('rejects already reversed → 400', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedBatch.reverseEntry.mockRejectedValue(
        new DepreciationError('Lancamento ja estornado', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/entries/entry-1/reverse`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Lancamento ja estornado');
    });
  });

  describe('GET /api/org/:orgId/depreciation/report', () => {
    it('returns paginated entries → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getReport.mockResolvedValue({
        entries: [BASE_ENTRY],
        total: 1,
        page: 1,
        limit: 20,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/depreciation/report`)
        .query({ periodYear: '2025', periodMonth: '1' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('returns empty array when no entries → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getReport.mockResolvedValue({
        entries: [],
        total: 0,
        page: 1,
        limit: 20,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/depreciation/report`)
        .query({ periodYear: '2025', periodMonth: '1' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(0);
    });

    it('filters by assetId when query param provided → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getReport.mockResolvedValue({
        entries: [BASE_ENTRY],
        total: 1,
        page: 1,
        limit: 20,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/depreciation/report`)
        .query({ periodYear: '2025', periodMonth: '1', assetId: 'asset-1' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.getReport).toHaveBeenCalledWith(
        expect.objectContaining({ assetId: 'asset-1' }),
      );
    });
  });

  describe('GET /api/org/:orgId/depreciation/report/export', () => {
    it('returns CSV with correct Content-Type → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.exportReport.mockResolvedValue(
        Buffer.from('Ativo,Tipo,Tag,Valor Anterior,Depreciacao,Valor Atual,Centro de Custo,Track'),
      );

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/depreciation/report/export`)
        .query({ periodYear: '2025', periodMonth: '1', format: 'csv' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });

    it('returns XLSX with correct Content-Type → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.exportReport.mockResolvedValue(Buffer.from('xlsx content'));

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/depreciation/report/export`)
        .query({ periodYear: '2025', periodMonth: '1', format: 'xlsx' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(
        /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
      );
    });
  });

  describe('GET /api/org/:orgId/depreciation/last-run', () => {
    it('returns latest run → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getLastRun.mockResolvedValue(BASE_RUN as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/depreciation/last-run`)
        .query({ periodYear: '2025', periodMonth: '1' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('run-1');
    });

    it('returns null when no run → 200', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getLastRun.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/depreciation/last-run`)
        .query({ periodYear: '2025', periodMonth: '1' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });
  });

  describe('Batch integration', () => {
    it('processes STRAIGHT_LINE asset correctly (entry created with correct amounts)', async () => {
      authAs(ADMIN_PAYLOAD);
      const detailedRun = {
        ...BASE_RUN,
        processedCount: 1,
        totalAmount: new Decimal('1875.00'),
      };
      mockedBatch.runDepreciationBatch.mockResolvedValue(detailedRun as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/run`)
        .set('Authorization', 'Bearer token')
        .send({ periodYear: 2025, periodMonth: 1, track: 'FISCAL' });

      expect(res.status).toBe(202);
      expect(res.body.processedCount).toBe(1);
    });

    it('creates DepreciationEntryCCItem for asset with costCenterId', async () => {
      authAs(ADMIN_PAYLOAD);
      const runWithCC = {
        ...BASE_RUN,
        processedCount: 1,
        totalAmount: new Decimal('1875.00'),
      };
      mockedBatch.runDepreciationBatch.mockResolvedValue(runWithCC as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/depreciation/run`)
        .set('Authorization', 'Bearer token')
        .send({ periodYear: 2025, periodMonth: 1, track: 'FISCAL' });

      expect(res.status).toBe(202);
      expect(mockedBatch.runDepreciationBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          periodYear: 2025,
          periodMonth: 1,
        }),
      );
    });
  });
});
