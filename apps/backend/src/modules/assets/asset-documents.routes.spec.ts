import request from 'supertest';
import { app } from '../../app';
import * as assetDocumentsService from './asset-documents.service';
import * as authService from '../auth/auth.service';
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

jest.mock('./asset-documents.service', () => ({
  createAssetDocument: jest.fn(),
  listAssetDocuments: jest.fn(),
  getExpiringDocuments: jest.fn(),
  updateAssetDocument: jest.fn(),
  deleteAssetDocument: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(assetDocumentsService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const VALID_DOCUMENT = {
  id: 'doc-1',
  organizationId: ORG_ID,
  assetId: 'asset-1',
  documentType: 'CRLV',
  documentName: 'CRLV 2026',
  description: 'Certificado de registro e licenciamento',
  expiresAt: new Date('2026-12-31').toISOString(),
  fileUrl: null,
  createdBy: 'manager-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  asset: { name: 'Trator John Deere', assetTag: 'PAT-00001' },
};

const VALID_DOCUMENT_NO_EXPIRY = {
  ...VALID_DOCUMENT,
  id: 'doc-2',
  documentType: 'LAUDO',
  documentName: 'Laudo de inspeção',
  expiresAt: null,
};

describe('Asset Documents API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(MANAGER_PAYLOAD);
  });

  describe('POST /api/org/:orgId/asset-documents', () => {
    it('creates document with documentType and expiresAt', async () => {
      mockedService.createAssetDocument.mockResolvedValue(VALID_DOCUMENT as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/asset-documents`)
        .set('Authorization', 'Bearer token')
        .send({
          assetId: 'asset-1',
          documentType: 'CRLV',
          documentName: 'CRLV 2026',
          expiresAt: '2026-12-31',
        });

      expect(res.status).toBe(201);
      expect(mockedService.createAssetDocument).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ documentType: 'CRLV', documentName: 'CRLV 2026' }),
      );
      expect(res.body.documentType).toBe('CRLV');
      expect(res.body.expiresAt).toBeDefined();
    });

    it('creates document without expiresAt', async () => {
      mockedService.createAssetDocument.mockResolvedValue(VALID_DOCUMENT_NO_EXPIRY as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/asset-documents`)
        .set('Authorization', 'Bearer token')
        .send({
          assetId: 'asset-1',
          documentType: 'LAUDO',
          documentName: 'Laudo de inspeção',
        });

      expect(res.status).toBe(201);
      expect(res.body.expiresAt).toBeNull();
    });

    it('returns 400 when required fields are missing', async () => {
      mockedService.createAssetDocument.mockRejectedValue(
        new AssetError('Tipo de documento é obrigatório', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/asset-documents`)
        .set('Authorization', 'Bearer token')
        .send({ assetId: 'asset-1', documentName: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/org/:orgId/asset-documents', () => {
    it('returns documents filtered by assetId', async () => {
      const mockList = {
        data: [VALID_DOCUMENT],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockedService.listAssetDocuments.mockResolvedValue(mockList as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/asset-documents?assetId=asset-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listAssetDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ assetId: 'asset-1' }),
      );
      expect(res.body.data).toHaveLength(1);
    });

    it('filters by expiringWithinDays', async () => {
      const mockList = { data: [VALID_DOCUMENT], total: 1, page: 1, limit: 20, totalPages: 1 };
      mockedService.listAssetDocuments.mockResolvedValue(mockList as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/asset-documents?expiringWithinDays=30`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listAssetDocuments).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expiringWithinDays: 30 }),
      );
    });
  });

  describe('GET /api/org/:orgId/asset-documents/expiring', () => {
    const mockExpiring = {
      expired: { count: 1, items: [{ documentId: 'doc-x', daysUntilExpiry: -3 }] },
      urgent: { count: 1, items: [{ documentId: 'doc-y', daysUntilExpiry: 5 }] },
      warning: { count: 0, items: [] },
      upcoming: { count: 1, items: [{ documentId: 'doc-z', daysUntilExpiry: 25 }] },
    };

    it('returns expired, urgent, warning, upcoming groups', async () => {
      mockedService.getExpiringDocuments.mockResolvedValue(mockExpiring as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/asset-documents/expiring`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('expired');
      expect(res.body).toHaveProperty('urgent');
      expect(res.body).toHaveProperty('warning');
      expect(res.body).toHaveProperty('upcoming');
    });

    it('correctly classifies documents by days until expiry', async () => {
      mockedService.getExpiringDocuments.mockResolvedValue(mockExpiring as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/asset-documents/expiring`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.expired.count).toBe(1);
      expect(res.body.urgent.count).toBe(1);
      expect(res.body.warning.count).toBe(0);
      expect(res.body.upcoming.count).toBe(1);
      expect(res.body.expired.items[0].daysUntilExpiry).toBe(-3);
      expect(res.body.urgent.items[0].daysUntilExpiry).toBe(5);
    });
  });

  describe('PATCH /api/org/:orgId/asset-documents/:id', () => {
    it('updates document fields', async () => {
      const updated = { ...VALID_DOCUMENT, documentName: 'CRLV 2027' };
      mockedService.updateAssetDocument.mockResolvedValue(updated as never);

      const res = await request(app)
        .patch(`/api/org/${ORG_ID}/asset-documents/doc-1`)
        .set('Authorization', 'Bearer token')
        .send({ documentName: 'CRLV 2027' });

      expect(res.status).toBe(200);
      expect(mockedService.updateAssetDocument).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        'doc-1',
        expect.objectContaining({ documentName: 'CRLV 2027' }),
      );
      expect(res.body.documentName).toBe('CRLV 2027');
    });
  });

  describe('DELETE /api/org/:orgId/asset-documents/:id', () => {
    it('deletes document', async () => {
      mockedService.deleteAssetDocument.mockResolvedValue(VALID_DOCUMENT as never);

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/asset-documents/doc-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
      expect(mockedService.deleteAssetDocument).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        'doc-1',
      );
    });
  });
});
