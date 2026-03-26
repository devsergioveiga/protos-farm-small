import request from 'supertest';
import { app } from '../../app';
import * as disposalService from './asset-disposals.service';
import * as authService from '../auth/auth.service';
import { AssetDisposalError } from './asset-disposals.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-disposals.service', () => ({
  createDisposal: jest.fn(),
  getDisposal: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(disposalService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: ORG_ID,
};

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: ORG_ID,
};

const CONSULTANT_PAYLOAD = {
  userId: 'consultant-1',
  email: 'consultant@org.com',
  role: 'CONSULTANT' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Test fixtures ─────────────────────────────────────────────────────

const ASSET_ID = 'asset-1';
const BASE_DISPOSE = `/api/org/${ORG_ID}/asset-disposals/${ASSET_ID}/dispose`;
const BASE_DISPOSAL = `/api/org/${ORG_ID}/asset-disposals/${ASSET_ID}/disposal`;

const SALE_OUTPUT = {
  id: 'disposal-1',
  assetId: ASSET_ID,
  assetTag: 'PAT-00001',
  assetName: 'Trator John Deere',
  disposalType: 'VENDA' as const,
  disposalTypeLabel: 'Venda',
  disposalDate: '2026-04-25T00:00:00.000Z',
  saleValue: 80000,
  netBookValue: 70000,
  gainLoss: 10000,
  buyerName: 'Fazenda Boa Vista',
  motivation: null,
  documentUrl: null,
  receivableId: 'receivable-1',
  installmentCount: 1,
  cancelledDepreciationCount: 2,
  createdBy: 'admin-1',
  createdAt: '2026-04-25T00:00:00.000Z',
};

const WRITEOFF_OUTPUT = {
  id: 'disposal-2',
  assetId: ASSET_ID,
  assetTag: 'PAT-00001',
  assetName: 'Trator John Deere',
  disposalType: 'DESCARTE' as const,
  disposalTypeLabel: 'Descarte',
  disposalDate: '2026-04-25T00:00:00.000Z',
  saleValue: null,
  netBookValue: 70000,
  gainLoss: -70000,
  buyerName: null,
  motivation: 'Equipamento obsoleto e inutilizavel',
  documentUrl: null,
  receivableId: null,
  installmentCount: 1,
  cancelledDepreciationCount: 2,
  createdBy: 'admin-1',
  createdAt: '2026-04-25T00:00:00.000Z',
};

const INSTALLMENT_SALE_OUTPUT = {
  ...SALE_OUTPUT,
  id: 'disposal-3',
  installmentCount: 3,
};

// ─── Tests ─────────────────────────────────────────────────────────────

describe('Asset Disposals API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Test 1: POST VENDA creates disposal + asset ALIENADO + Receivable ─

  describe('POST /:assetId/dispose', () => {
    it('Test 1: VENDA creates AssetDisposal + asset status ALIENADO + Receivable ASSET_SALE — returns 201 with gainLoss', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createDisposal.mockResolvedValue(SALE_OUTPUT);

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'VENDA',
          disposalDate: '2026-04-25',
          saleValue: 80000,
          buyerName: 'Fazenda Boa Vista',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(201);
      expect(res.body.gainLoss).toBe(10000);
      expect(res.body.receivableId).toBe('receivable-1');
      expect(res.body.disposalType).toBe('VENDA');
      expect(mockedService.createDisposal).toHaveBeenCalledTimes(1);
    });

    // ─── Test 2: gainLoss = saleValue - netBookValue ────────────────────

    it('Test 2: gainLoss equals saleValue minus netBookValue', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.createDisposal.mockResolvedValue(SALE_OUTPUT);

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'VENDA',
          disposalDate: '2026-04-25',
          saleValue: 80000,
          buyerName: 'Comprador',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(201);
      expect(res.body.gainLoss).toBe(res.body.saleValue - res.body.netBookValue);
    });

    // ─── Test 3: VENDA with no depreciation uses acquisitionValue ───────

    it('Test 3: VENDA with no depreciation entries uses acquisitionValue as netBookValue (service logic)', async () => {
      authAs(ADMIN_PAYLOAD);
      const outputNoDepr = {
        ...SALE_OUTPUT,
        netBookValue: 100000,
        gainLoss: -20000,
        cancelledDepreciationCount: 0,
      };
      mockedService.createDisposal.mockResolvedValue(outputNoDepr);

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'VENDA',
          disposalDate: '2026-04-25',
          saleValue: 80000,
          buyerName: 'Comprador',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(201);
      expect(res.body.cancelledDepreciationCount).toBe(0);
      expect(res.body.netBookValue).toBe(100000);
    });

    // ─── Test 4: DESCARTE creates disposal with no Receivable + gainLoss = -netBookValue ─

    it('Test 4: DESCARTE creates disposal with gainLoss = -netBookValue, no Receivable', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createDisposal.mockResolvedValue(WRITEOFF_OUTPUT);

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'DESCARTE',
          disposalDate: '2026-04-25',
          motivation: 'Equipamento obsoleto e inutilizavel',
        });

      expect(res.status).toBe(201);
      expect(res.body.receivableId).toBeNull();
      expect(res.body.gainLoss).toBe(-70000);
      expect(res.body.saleValue).toBeNull();
    });

    // ─── Test 5: SINISTRO creates disposal with motivation ───────────────

    it('Test 5: SINISTRO creates disposal with motivation required', async () => {
      authAs(ADMIN_PAYLOAD);
      const sinistroOutput = { ...WRITEOFF_OUTPUT, disposalType: 'SINISTRO' as const, disposalTypeLabel: 'Sinistro', motivation: 'Incendio' };
      mockedService.createDisposal.mockResolvedValue(sinistroOutput);

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'SINISTRO',
          disposalDate: '2026-04-25',
          motivation: 'Incendio',
        });

      expect(res.status).toBe(201);
      expect(res.body.motivation).toBe('Incendio');
    });

    // ─── Test 6: OBSOLESCENCIA similar to DESCARTE ───────────────────────

    it('Test 6: OBSOLESCENCIA creates disposal without receivable', async () => {
      authAs(ADMIN_PAYLOAD);
      const obsOutput = { ...WRITEOFF_OUTPUT, disposalType: 'OBSOLESCENCIA' as const, disposalTypeLabel: 'Obsolescencia' };
      mockedService.createDisposal.mockResolvedValue(obsOutput);

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'OBSOLESCENCIA',
          disposalDate: '2026-04-25',
          motivation: 'Tecnologia superada',
        });

      expect(res.status).toBe(201);
      expect(res.body.receivableId).toBeNull();
    });

    // ─── Test 7: Disposal atomically cancels pending DepreciationEntry rows ─

    it('Test 7: disposal returns cancelledDepreciationCount reflecting cancelled entries', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createDisposal.mockResolvedValue({ ...SALE_OUTPUT, cancelledDepreciationCount: 5 });

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'VENDA',
          disposalDate: '2026-04-25',
          saleValue: 80000,
          buyerName: 'Comprador',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(201);
      expect(res.body.cancelledDepreciationCount).toBe(5);
    });

    // ─── Test 8: installmentCount=3 creates 3 ReceivableInstallments ────

    it('Test 8: installmentCount=3 creates 3 ReceivableInstallments summing to saleValue', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createDisposal.mockResolvedValue(INSTALLMENT_SALE_OUTPUT);

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'VENDA',
          disposalDate: '2026-04-25',
          saleValue: 80000,
          buyerName: 'Comprador',
          installmentCount: 3,
          firstDueDate: '2026-05-10',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(201);
      expect(res.body.installmentCount).toBe(3);
    });

    // ─── Test 9: POST on ALIENADO asset returns 409 ─────────────────────

    it('Test 9: POST on already-ALIENADO asset returns 409', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createDisposal.mockRejectedValue(
        new AssetDisposalError('Ativo ja foi alienado', 409),
      );

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'VENDA',
          disposalDate: '2026-04-25',
          saleValue: 80000,
          buyerName: 'Comprador',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(409);
    });

    // ─── Test 10: POST on non-existent asset returns 404 ────────────────

    it('Test 10: POST on non-existent asset returns 404', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createDisposal.mockRejectedValue(
        new AssetDisposalError('Ativo nao encontrado', 404),
      );

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'VENDA',
          disposalDate: '2026-04-25',
          saleValue: 80000,
          buyerName: 'Comprador',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(404);
    });

    // ─── Test 11: VENDA without saleValue returns 400 ────────────────────

    it('Test 11: VENDA without saleValue returns 400', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createDisposal.mockRejectedValue(
        new AssetDisposalError('Valor de venda obrigatorio para alienacao por venda', 400),
      );

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'VENDA',
          disposalDate: '2026-04-25',
          buyerName: 'Comprador',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(400);
    });

    // ─── Test 12: VENDA without dueDate returns 400 ──────────────────────

    it('Test 12: VENDA without dueDate returns 400', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createDisposal.mockRejectedValue(
        new AssetDisposalError('Data de vencimento obrigatoria para venda', 400),
      );

      const res = await request(app)
        .post(BASE_DISPOSE)
        .set('Authorization', 'Bearer token')
        .send({
          disposalType: 'VENDA',
          disposalDate: '2026-04-25',
          saleValue: 80000,
          buyerName: 'Comprador',
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /:assetId/disposal ────────────────────────────────────────

  describe('GET /:assetId/disposal', () => {
    // ─── Test 13: GET returns disposal record with asset info ──────────

    it('Test 13: GET returns disposal record with asset info', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getDisposal.mockResolvedValue(SALE_OUTPUT);

      const res = await request(app)
        .get(BASE_DISPOSAL)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.assetTag).toBe('PAT-00001');
      expect(res.body.assetName).toBe('Trator John Deere');
      expect(res.body.receivableId).toBe('receivable-1');
    });

    // ─── Test 14: GET on asset without disposal returns 404 ───────────

    it('Test 14: GET on asset without disposal returns 404', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getDisposal.mockRejectedValue(
        new AssetDisposalError('Alienacao nao encontrada para este ativo', 404),
      );

      const res = await request(app)
        .get(BASE_DISPOSAL)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });
});
