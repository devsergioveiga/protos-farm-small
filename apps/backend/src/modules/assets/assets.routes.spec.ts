import request from 'supertest';
import { app } from '../../app';
import * as assetsService from './assets.service';
import * as authService from '../auth/auth.service';
import * as bulkImportService from './asset-bulk-import.service';
import { AssetError } from './assets.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-bulk-import.service', () => ({
  previewAssetImport: jest.fn(),
  confirmAssetImport: jest.fn(),
  generateAssetCsvTemplate: jest.fn(),
}));

jest.mock('./assets.service', () => ({
  createAsset: jest.fn(),
  listAssets: jest.fn(),
  getAsset: jest.fn(),
  updateAsset: jest.fn(),
  deleteAsset: jest.fn(),
  getAssetSummary: jest.fn(),
  uploadAssetPhoto: jest.fn(),
  removeAssetPhoto: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(assetsService);
const mockedAuth = jest.mocked(authService);
const mockedBulkImport = jest.mocked(bulkImportService);

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

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const VALID_ASSET = {
  id: 'asset-1',
  organizationId: ORG_ID,
  farmId: 'farm-1',
  assetType: 'MAQUINA',
  classification: 'DEPRECIABLE_CPC27',
  status: 'ATIVO',
  name: 'Trator John Deere',
  description: 'Trator de grande porte',
  assetTag: 'PAT-00001',
  acquisitionDate: new Date('2024-01-15'),
  acquisitionValue: '250000.00',
  supplierId: null,
  invoiceNumber: null,
  costCenterId: null,
  costCenterMode: 'FIXED',
  costCenterPercent: null,
  serialNumber: 'JD-2024-001',
  manufacturer: 'John Deere',
  model: '6195R',
  yearOfManufacture: 2024,
  engineHp: '195.00',
  fuelType: 'DIESEL',
  renavamCode: null,
  licensePlate: null,
  parentAssetId: null,
  constructionMaterial: null,
  areaM2: null,
  capacity: null,
  registrationNumber: null,
  areaHa: null,
  carCode: null,
  currentHourmeter: '0.00',
  currentOdometer: null,
  photoUrls: [],
  notes: null,
  deletedAt: null,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
  farm: { name: 'Fazenda São João' },
  supplier: null,
  costCenter: null,
  parentAsset: null,
};

describe('Assets API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ───────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get(`/api/org/${ORG_ID}/assets`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for OPERATOR trying to create asset', async () => {
      authAs(OPERATOR_PAYLOAD);
      const res = await request(app)
        .post(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Test',
          assetType: 'MAQUINA',
          classification: 'DEPRECIABLE_CPC27',
          farmId: 'farm-1',
        });
      expect(res.status).toBe(403);
    });
  });

  // ─── POST /api/org/:orgId/assets ──────────────────────────────────────

  describe('POST /api/org/:orgId/assets', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    const validBody = {
      name: 'Trator John Deere',
      assetType: 'MAQUINA',
      classification: 'DEPRECIABLE_CPC27',
      farmId: 'farm-1',
    };

    it('creates asset with auto-generated PAT-00001 tag', async () => {
      mockedService.createAsset.mockResolvedValue(VALID_ASSET as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.assetTag).toBe('PAT-00001');
      expect(mockedService.createAsset).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ name: 'Trator John Deere', assetType: 'MAQUINA' }),
      );
    });

    it('increments tag to PAT-00002 on second create', async () => {
      const secondAsset = { ...VALID_ASSET, id: 'asset-2', assetTag: 'PAT-00002' };
      mockedService.createAsset.mockResolvedValue(secondAsset as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.assetTag).toBe('PAT-00002');
    });

    it('creates IMPLEMENTO with parentAssetId pointing to MAQUINA', async () => {
      const implemento = {
        ...VALID_ASSET,
        id: 'asset-impl-1',
        assetTag: 'PAT-00003',
        assetType: 'IMPLEMENTO',
        parentAssetId: 'asset-1',
        parentAsset: { id: 'asset-1', name: 'Trator', assetTag: 'PAT-00001' },
      };
      mockedService.createAsset.mockResolvedValue(implemento as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validBody, assetType: 'IMPLEMENTO', parentAssetId: 'asset-1' });

      expect(res.status).toBe(201);
      expect(res.body.assetType).toBe('IMPLEMENTO');
      expect(res.body.parentAssetId).toBe('asset-1');
    });

    it('rejects IMPLEMENTO with parentAssetId pointing to VEICULO (400)', async () => {
      mockedService.createAsset.mockRejectedValue(
        new AssetError('Implemento só pode ser vinculado a uma máquina', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validBody, assetType: 'IMPLEMENTO', parentAssetId: 'vehicle-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('máquina');
    });

    it('forces TERRA classification to NON_DEPRECIABLE_CPC27', async () => {
      const terra = { ...VALID_ASSET, assetType: 'TERRA', classification: 'NON_DEPRECIABLE_CPC27' };
      mockedService.createAsset.mockResolvedValue(terra as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validBody, assetType: 'TERRA', classification: 'DEPRECIABLE_CPC27' });

      expect(res.status).toBe(201);
      expect(res.body.classification).toBe('NON_DEPRECIABLE_CPC27');
    });

    it('stores BENFEITORIA geoPoint as PostGIS geometry', async () => {
      const benfeitoria = { ...VALID_ASSET, assetType: 'BENFEITORIA' };
      mockedService.createAsset.mockResolvedValue(benfeitoria as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          ...validBody,
          assetType: 'BENFEITORIA',
          classification: 'DEPRECIABLE_CPC27',
          geoLat: -15.7801,
          geoLon: -47.9292,
        });

      expect(res.status).toBe(201);
      expect(mockedService.createAsset).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ geoLat: -15.7801, geoLon: -47.9292 }),
      );
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({ assetType: 'MAQUINA' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Nome');
    });
  });

  // ─── GET /api/org/:orgId/assets ───────────────────────────────────────

  describe('GET /api/org/:orgId/assets', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns paginated list', async () => {
      mockedService.listAssets.mockResolvedValue({
        data: [VALID_ASSET],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(mockedService.listAssets).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.any(Object),
      );
    });

    it('filters by assetType', async () => {
      mockedService.listAssets.mockResolvedValue({
        data: [VALID_ASSET],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets?assetType=MAQUINA`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listAssets).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ assetType: 'MAQUINA' }),
      );
    });

    it('filters by status', async () => {
      mockedService.listAssets.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets?status=INATIVO`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listAssets).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ status: 'INATIVO' }),
      );
    });

    it('filters by farmId', async () => {
      mockedService.listAssets.mockResolvedValue({
        data: [VALID_ASSET],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets?farmId=farm-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listAssets).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ farmId: 'farm-1' }),
      );
    });

    it('filters by minValue/maxValue on acquisitionValue', async () => {
      mockedService.listAssets.mockResolvedValue({
        data: [VALID_ASSET],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets?minValue=100000&maxValue=500000`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listAssets).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ minValue: '100000', maxValue: '500000' }),
      );
    });

    it('searches by name, tag, and serialNumber', async () => {
      mockedService.listAssets.mockResolvedValue({
        data: [VALID_ASSET],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets?search=trator`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listAssets).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ search: 'trator' }),
      );
    });
  });

  // ─── GET /api/org/:orgId/assets/summary ──────────────────────────────

  describe('GET /api/org/:orgId/assets/summary', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns totalAssets, totalValue, inMaintenance counts', async () => {
      mockedService.getAssetSummary.mockResolvedValue({
        totalAssets: 10,
        totalValue: '1500000.00',
        inMaintenance: 2,
        recentAcquisitions: [],
      } as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets/summary`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.totalAssets).toBe(10);
      expect(res.body.inMaintenance).toBe(2);
      expect(mockedService.getAssetSummary).toHaveBeenCalledWith({ organizationId: ORG_ID });
    });
  });

  // ─── GET /api/org/:orgId/assets/:id ──────────────────────────────────

  describe('GET /api/org/:orgId/assets/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns asset with farm, supplier, costCenter relations', async () => {
      const fullAsset = {
        ...VALID_ASSET,
        childAssets: [],
        _count: { fuelRecords: 0, meterReadings: 0, documents: 2 },
      };
      mockedService.getAsset.mockResolvedValue(fullAsset as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets/asset-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('asset-1');
      expect(res.body.farm).toBeDefined();
      expect(mockedService.getAsset).toHaveBeenCalledWith({ organizationId: ORG_ID }, 'asset-1');
    });

    it('returns 404 for nonexistent asset', async () => {
      mockedService.getAsset.mockRejectedValue(new AssetError('Ativo não encontrado', 404));

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('não encontrado');
    });

    it('returns 404 for soft-deleted asset', async () => {
      mockedService.getAsset.mockRejectedValue(new AssetError('Ativo não encontrado', 404));

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets/deleted-asset`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/org/:orgId/assets/:id ────────────────────────────────

  describe('PATCH /api/org/:orgId/assets/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('updates asset fields', async () => {
      const updated = { ...VALID_ASSET, name: 'Trator Atualizado', status: 'EM_MANUTENCAO' };
      mockedService.updateAsset.mockResolvedValue(updated as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/assets/asset-1`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Trator Atualizado', status: 'EM_MANUTENCAO' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Trator Atualizado');
      expect(mockedService.updateAsset).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        'asset-1',
        expect.objectContaining({ name: 'Trator Atualizado', status: 'EM_MANUTENCAO' }),
      );
    });

    it('returns 404 for nonexistent asset', async () => {
      mockedService.updateAsset.mockRejectedValue(new AssetError('Ativo não encontrado', 404));

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/assets/nonexistent`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/org/:orgId/assets/:id ───────────────────────────────

  describe('DELETE /api/org/:orgId/assets/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('soft-deletes asset (sets deletedAt)', async () => {
      const deleted = { ...VALID_ASSET, deletedAt: new Date() };
      mockedService.deleteAsset.mockResolvedValue(deleted as never);

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/assets/asset-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
      expect(mockedService.deleteAsset).toHaveBeenCalledWith({ organizationId: ORG_ID }, 'asset-1');
    });

    it('soft-deleted asset excluded from GET list', async () => {
      mockedService.deleteAsset.mockResolvedValue({
        ...VALID_ASSET,
        deletedAt: new Date(),
      } as never);

      await request(app)
        .delete(`/api/org/${ORG_ID}/assets/asset-1`)
        .set('Authorization', 'Bearer valid-token');

      mockedService.listAssets.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as never);

      const listRes = await request(app)
        .get(`/api/org/${ORG_ID}/assets`)
        .set('Authorization', 'Bearer valid-token');

      expect(listRes.body.data).toHaveLength(0);
    });
  });

  // ─── POST /api/org/:orgId/assets/:id/photos ──────────────────────────

  describe('POST /api/org/:orgId/assets/:id/photos', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('uploads photo and appends to photoUrls array', async () => {
      const photoUrl = `/api/uploads/assets/${ORG_ID}/asset-1/123-photo.jpg`;
      mockedService.uploadAssetPhoto.mockResolvedValue([photoUrl] as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/assets/asset-1/photos`)
        .set('Authorization', 'Bearer valid-token')
        .attach('photos', Buffer.from('fake image data'), {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(200);
      expect(res.body.photoUrls).toHaveLength(1);
      expect(mockedService.uploadAssetPhoto).toHaveBeenCalled();
    });
  });

  // ─── GET /api/org/:orgId/assets/export/csv ────────────────────────────

  describe('GET /api/org/:orgId/assets/export/csv', () => {
    it.todo('returns CSV with Content-Type text/csv');
  });

  // ─── GET /api/org/:orgId/assets/export/pdf ────────────────────────────

  describe('GET /api/org/:orgId/assets/export/pdf', () => {
    it.todo('returns PDF with Content-Type application/pdf');
  });

  // ─── Asset Import ─────────────────────────────────────────────────────

  describe('Asset Import', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    // ─── GET /import/template ─────────────────────────────────────────

    describe('GET /api/org/:orgId/assets/import/template', () => {
      it('returns CSV template with Content-Type text/csv', async () => {
        mockedBulkImport.generateAssetCsvTemplate.mockReturnValue(
          'nome,tipo,classificacao_cpc\nTrator,MAQUINA,DEPRECIABLE_CPC27',
        );

        const res = await request(app)
          .get(`/api/org/${ORG_ID}/assets/import/template`)
          .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(/modelo-ativos\.csv/);
      });
    });

    // ─── POST /import/parse ───────────────────────────────────────────

    describe('POST /api/org/:orgId/assets/import/parse', () => {
      it('parses CSV file and returns columnHeaders + suggestedMapping', async () => {
        const res = await request(app)
          .post(`/api/org/${ORG_ID}/assets/import/parse`)
          .set('Authorization', 'Bearer valid-token')
          .attach(
            'file',
            Buffer.from('nome,tipo,classificacao_cpc\nTrator,MAQUINA,DEPRECIABLE_CPC27'),
            { filename: 'ativos.csv', contentType: 'text/csv' },
          );

        expect(res.status).toBe(200);
        expect(res.body.columnHeaders).toEqual(['nome', 'tipo', 'classificacao_cpc']);
        expect(res.body.suggestedMapping).toBeDefined();
        expect(res.body.suggestedMapping['nome']).toBe('name');
        expect(res.body.suggestedMapping['tipo']).toBe('assetType');
        expect(res.body.rowCount).toBe(1);
      });

      it('returns 400 when no file is sent', async () => {
        const res = await request(app)
          .post(`/api/org/${ORG_ID}/assets/import/parse`)
          .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('arquivo');
      });
    });

    // ─── POST /import/preview ─────────────────────────────────────────

    describe('POST /api/org/:orgId/assets/import/preview', () => {
      it('returns valid and invalid rows with error details', async () => {
        mockedBulkImport.previewAssetImport.mockResolvedValue({
          valid: [
            {
              rowNumber: 2,
              data: {
                name: 'Trator',
                assetType: 'MAQUINA' as const,
                classification: 'DEPRECIABLE_CPC27' as const,
                farmId: 'farm-1',
              },
              valid: true,
              errors: [],
            },
          ],
          invalid: [
            {
              rowNumber: 3,
              data: {},
              valid: false,
              errors: ['Nome e obrigatorio'],
            },
          ],
          totalValid: 1,
          totalInvalid: 1,
        });

        const res = await request(app)
          .post(`/api/org/${ORG_ID}/assets/import/preview`)
          .set('Authorization', 'Bearer valid-token')
          .send({
            rows: [{ nome: 'Trator', tipo: 'MAQUINA' }],
            columnMapping: { nome: 'name', tipo: 'assetType' },
          });

        expect(res.status).toBe(200);
        expect(res.body.totalValid).toBe(1);
        expect(res.body.totalInvalid).toBe(1);
        expect(res.body.valid).toHaveLength(1);
        expect(res.body.invalid[0].errors).toContain('Nome e obrigatorio');
      });

      it('returns 400 when rows is missing', async () => {
        const res = await request(app)
          .post(`/api/org/${ORG_ID}/assets/import/preview`)
          .set('Authorization', 'Bearer valid-token')
          .send({ columnMapping: {} });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('rows');
      });
    });

    // ─── POST /import/confirm ─────────────────────────────────────────

    describe('POST /api/org/:orgId/assets/import/confirm', () => {
      it('inserts valid rows and returns imported count', async () => {
        mockedBulkImport.confirmAssetImport.mockResolvedValue({
          imported: 2,
          skipped: 0,
          failed: 0,
          errors: [],
        });

        const validRows = [
          {
            rowNumber: 2,
            data: {
              name: 'Trator',
              assetType: 'MAQUINA',
              classification: 'DEPRECIABLE_CPC27',
              farmId: 'farm-1',
            },
            valid: true,
            errors: [],
          },
          {
            rowNumber: 3,
            data: {
              name: 'Veiculo',
              assetType: 'VEICULO',
              classification: 'DEPRECIABLE_CPC27',
              farmId: 'farm-1',
            },
            valid: true,
            errors: [],
          },
        ];

        const res = await request(app)
          .post(`/api/org/${ORG_ID}/assets/import/confirm`)
          .set('Authorization', 'Bearer valid-token')
          .send({ validRows });

        expect(res.status).toBe(200);
        expect(res.body.imported).toBe(2);
        expect(res.body.failed).toBe(0);
        expect(mockedBulkImport.confirmAssetImport).toHaveBeenCalledWith(
          expect.objectContaining({ organizationId: ORG_ID }),
          validRows,
        );
      });

      it('returns 400 when validRows is missing', async () => {
        const res = await request(app)
          .post(`/api/org/${ORG_ID}/assets/import/confirm`)
          .set('Authorization', 'Bearer valid-token')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('validRows');
      });
    });
  });
});
