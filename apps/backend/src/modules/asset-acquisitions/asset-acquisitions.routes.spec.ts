import request from 'supertest';
import { app } from '../../app';
import * as acquisitionService from './asset-acquisitions.service';
import * as authService from '../auth/auth.service';
import { AssetAcquisitionError } from './asset-acquisitions.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-acquisitions.service', () => ({
  createAcquisitionAndPayable: jest.fn(),
  parseNfeUpload: jest.fn(),
  createFromNfe: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(acquisitionService);
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

const VALID_ACQUISITION_OUTPUT = {
  asset: { id: 'asset-1', assetTag: 'PAT-00001', name: 'Trator John Deere' },
  payableId: 'payable-1',
  installmentCount: 1,
};

const VALID_ACQUISITION_OUTPUT_FINANCED = {
  asset: { id: 'asset-2', assetTag: 'PAT-00002', name: 'Colheitadeira' },
  payableId: 'payable-2',
  installmentCount: 36,
};

const VALID_NFE_PARSED = {
  supplierName: 'Agro Máquinas SA',
  supplierCnpj: '12345678000195',
  invoiceNumber: '12345',
  issueDate: '2026-04-26T10:00:00-03:00',
  totalNf: '110.00',
  totalProducts: '100.00',
  freight: '5.00',
  insurance: '3.00',
  otherCosts: '2.00',
  items: [
    { description: 'Trator', value: 60, ncm: '87019100', quantity: 1, unit: 'UN' },
    { description: 'Grade', value: 40, ncm: '84322100', quantity: 2, unit: 'UN' },
  ],
};

const VALID_NFE_ACQUISITION_OUTPUT = {
  assets: [
    { id: 'asset-3', assetTag: 'PAT-00003', name: 'Trator', acquisitionValue: 66 },
    { id: 'asset-4', assetTag: 'PAT-00004', name: 'Grade', acquisitionValue: 44 },
  ],
  payableId: 'payable-3',
  totalNf: 110,
};

const BASE = `/api/org/${ORG_ID}/asset-acquisitions`;

// ─── Tests ─────────────────────────────────────────────────────────────

describe('Asset Acquisitions API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Test 1: POST / AVISTA creates Asset + 1 installment + cost center ─

  describe('POST /', () => {
    it('Test 1: AVISTA creates Asset + 1 Payable + 1 PayableInstallment + PayableCostCenterItem', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createAcquisitionAndPayable.mockResolvedValue(VALID_ACQUISITION_OUTPUT);

      const res = await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          name: 'Trator John Deere',
          assetType: 'MAQUINA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
          supplierId: 'supplier-1',
          acquisitionValue: 250000,
          acquisitionDate: '2026-04-26',
          paymentType: 'AVISTA',
          dueDate: '2026-05-10',
          costCenterId: 'cc-1',
        });

      expect(res.status).toBe(201);
      expect(res.body.asset.id).toBe('asset-1');
      expect(res.body.payableId).toBe('payable-1');
      expect(res.body.installmentCount).toBe(1);
      expect(mockedService.createAcquisitionAndPayable).toHaveBeenCalledTimes(1);
    });

    // ─── Test 2: Payable fields ─────────────────────────────────────────

    it('Test 2: service is called with correct params including category ASSET_ACQUISITION', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createAcquisitionAndPayable.mockResolvedValue(VALID_ACQUISITION_OUTPUT);

      await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          name: 'Trator',
          assetType: 'MAQUINA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
          supplierId: 'supplier-1',
          acquisitionValue: 150000,
          acquisitionDate: '2026-04-26',
          paymentType: 'AVISTA',
          dueDate: '2026-05-10',
        });

      expect(mockedService.createAcquisitionAndPayable).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({
          paymentType: 'AVISTA',
          dueDate: '2026-05-10',
        }),
      );
    });

    // ─── Test 3: FINANCIADO + 36 installments ──────────────────────────

    it('Test 3: FINANCIADO + installmentCount=36 returns 36 installments', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createAcquisitionAndPayable.mockResolvedValue(
        VALID_ACQUISITION_OUTPUT_FINANCED,
      );

      const res = await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          name: 'Colheitadeira',
          assetType: 'MAQUINA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
          supplierId: 'supplier-1',
          acquisitionValue: 800000,
          acquisitionDate: '2026-04-26',
          paymentType: 'FINANCIADO',
          installmentCount: 36,
          firstDueDate: '2026-06-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.installmentCount).toBe(36);
    });

    // ─── Test 4: Dates increment monthly ──────────────────────────────

    it('Test 4: service called with firstDueDate for FINANCIADO', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createAcquisitionAndPayable.mockResolvedValue(
        VALID_ACQUISITION_OUTPUT_FINANCED,
      );

      await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          name: 'Colheitadeira',
          assetType: 'MAQUINA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
          supplierId: 'supplier-1',
          acquisitionValue: 800000,
          acquisitionDate: '2026-04-26',
          paymentType: 'FINANCIADO',
          installmentCount: 36,
          firstDueDate: '2026-06-01',
        });

      expect(mockedService.createAcquisitionAndPayable).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({
          firstDueDate: '2026-06-01',
          installmentCount: 36,
        }),
      );
    });

    // ─── Test 5: Missing supplierId returns 400 when acquisitionValue > 0 ─

    it('Test 5: missing supplierId returns 400 when acquisitionValue > 0', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createAcquisitionAndPayable.mockRejectedValue(
        new AssetAcquisitionError('Fornecedor obrigatório para aquisição com valor', 400),
      );

      const res = await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          name: 'Trator',
          assetType: 'MAQUINA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
          acquisitionValue: 150000,
          acquisitionDate: '2026-04-26',
          paymentType: 'AVISTA',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Fornecedor');
    });

    // ─── Test 6: Missing dueDate returns 400 for AVISTA ───────────────

    it('Test 6: missing dueDate returns 400 when paymentType=AVISTA', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createAcquisitionAndPayable.mockRejectedValue(
        new AssetAcquisitionError('Data de vencimento obrigatória para pagamento à vista', 400),
      );

      const res = await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          name: 'Trator',
          assetType: 'MAQUINA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
          supplierId: 'supplier-1',
          acquisitionValue: 150000,
          acquisitionDate: '2026-04-26',
          paymentType: 'AVISTA',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('vencimento');
    });

    // ─── Test 13: 403 for CONSULTANT ──────────────────────────────────

    it('Test 13: returns 403 for CONSULTANT role (lacks assets:create permission)', async () => {
      authAs(CONSULTANT_PAYLOAD);

      const res = await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          name: 'Trator',
          assetType: 'MAQUINA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
          acquisitionValue: 100000,
          paymentType: 'AVISTA',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(403);
    });

    // ─── Test 14: No acquisitionValue → asset without CP ─────────────

    it('Test 14: no acquisitionValue creates asset without CP (payableId null)', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createAcquisitionAndPayable.mockResolvedValue({
        asset: { id: 'asset-5', assetTag: 'PAT-00005', name: 'Galpão' },
        payableId: null,
        installmentCount: 0,
      });

      const res = await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          name: 'Galpão',
          assetType: 'BENFEITORIA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
          paymentType: 'AVISTA',
        });

      expect(res.status).toBe(201);
      expect(res.body.payableId).toBeNull();
    });

    // ─── Test 12: Transaction rollback ────────────────────────────────

    it('Test 12: transaction rollback — service error returns 400 and no asset created', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createAcquisitionAndPayable.mockRejectedValue(
        new AssetAcquisitionError('Erro ao criar conta a pagar', 400),
      );

      const res = await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          name: 'Trator',
          assetType: 'MAQUINA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
          supplierId: 'supplier-1',
          acquisitionValue: 150000,
          paymentType: 'AVISTA',
          dueDate: '2026-05-10',
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /parse-nfe ───────────────────────────────────────────────

  describe('POST /parse-nfe', () => {
    it('Test 7: valid XML returns parsed NfeParsedData', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.parseNfeUpload.mockResolvedValue(VALID_NFE_PARSED);

      const xmlBuffer = Buffer.from('<NFe><infNFe></infNFe></NFe>');

      const res = await request(app)
        .post(`${BASE}/parse-nfe`)
        .set('Authorization', 'Bearer token')
        .attach('file', xmlBuffer, { filename: 'nfe.xml', contentType: 'text/xml' });

      expect(res.status).toBe(200);
      expect(res.body.supplierName).toBe('Agro Máquinas SA');
      expect(res.body.items).toHaveLength(2);
    });

    it('Test 8: no file returns 400', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.parseNfeUpload.mockRejectedValue(
        new AssetAcquisitionError('Arquivo XML não enviado', 400),
      );

      const res = await request(app)
        .post(`${BASE}/parse-nfe`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
    });

    it('Test 8b: invalid XML (service throws) returns 400', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.parseNfeUpload.mockRejectedValue(
        new AssetAcquisitionError('Nenhum item encontrado no XML', 400),
      );

      const xmlBuffer = Buffer.from('<invalid>xml</invalid>');

      const res = await request(app)
        .post(`${BASE}/parse-nfe`)
        .set('Authorization', 'Bearer token')
        .attach('file', xmlBuffer, { filename: 'nfe.xml', contentType: 'text/xml' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });
  });

  // ─── POST /from-nfe ────────────────────────────────────────────────

  describe('POST /from-nfe', () => {
    it('Test 9: creates N assets from NF-e items with rateio', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createFromNfe.mockResolvedValue(VALID_NFE_ACQUISITION_OUTPUT);

      const res = await request(app)
        .post(`${BASE}/from-nfe`)
        .set('Authorization', 'Bearer token')
        .send({
          farmId: 'farm-1',
          classification: 'DEPRECIABLE_CPC27',
          paymentType: 'AVISTA',
          dueDate: '2026-05-10',
          items: [
            { nfeItemIndex: 0, assetName: 'Trator', assetType: 'MAQUINA' },
            { nfeItemIndex: 1, assetName: 'Grade', assetType: 'IMPLEMENTO' },
          ],
          nfeParsed: VALID_NFE_PARSED,
        });

      expect(res.status).toBe(201);
      expect(res.body.assets).toHaveLength(2);
    });

    it('Test 10: creates 1 Payable with totalAmount = vNF (total NF)', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createFromNfe.mockResolvedValue(VALID_NFE_ACQUISITION_OUTPUT);

      const res = await request(app)
        .post(`${BASE}/from-nfe`)
        .set('Authorization', 'Bearer token')
        .send({
          farmId: 'farm-1',
          classification: 'DEPRECIABLE_CPC27',
          paymentType: 'AVISTA',
          dueDate: '2026-05-10',
          items: [
            { nfeItemIndex: 0, assetName: 'Trator', assetType: 'MAQUINA' },
            { nfeItemIndex: 1, assetName: 'Grade', assetType: 'IMPLEMENTO' },
          ],
          nfeParsed: VALID_NFE_PARSED,
        });

      expect(res.status).toBe(201);
      expect(res.body.payableId).toBe('payable-3');
      expect(res.body.totalNf).toBe(110);
    });

    it('Test 11: sum of asset acquisitionValues equals totalNf in multi-asset NF', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createFromNfe.mockResolvedValue(VALID_NFE_ACQUISITION_OUTPUT);

      const res = await request(app)
        .post(`${BASE}/from-nfe`)
        .set('Authorization', 'Bearer token')
        .send({
          farmId: 'farm-1',
          classification: 'DEPRECIABLE_CPC27',
          paymentType: 'AVISTA',
          dueDate: '2026-05-10',
          items: [
            { nfeItemIndex: 0, assetName: 'Trator', assetType: 'MAQUINA' },
            { nfeItemIndex: 1, assetName: 'Grade', assetType: 'IMPLEMENTO' },
          ],
          nfeParsed: VALID_NFE_PARSED,
        });

      expect(res.status).toBe(201);
      const total = res.body.assets.reduce(
        (sum: number, a: { acquisitionValue: number }) => sum + a.acquisitionValue,
        0,
      );
      expect(Math.abs(total - res.body.totalNf)).toBeLessThan(0.001);
    });
  });
});
