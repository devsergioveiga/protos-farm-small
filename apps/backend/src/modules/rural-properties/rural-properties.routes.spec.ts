import request from 'supertest';
import { app } from '../../app';
import * as ruralPropertiesService from './rural-properties.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { RuralPropertyError } from './rural-properties.types';

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

jest.mock('./rural-properties.service', () => ({
  createRuralProperty: jest.fn(),
  listRuralProperties: jest.fn(),
  getRuralProperty: jest.fn(),
  updateRuralProperty: jest.fn(),
  deleteRuralProperty: jest.fn(),
  addOwner: jest.fn(),
  updateOwner: jest.fn(),
  deleteOwner: jest.fn(),
  uploadDocument: jest.fn(),
  listDocuments: jest.fn(),
  getDocument: jest.fn(),
  deleteDocument: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(ruralPropertiesService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const FARM_ID = 'farm-1';
const PROPERTY_ID = 'prop-1';
const OWNER_ID = 'owner-1';
const DOC_ID = 'doc-1';

const SAMPLE_PROPERTY = {
  id: PROPERTY_ID,
  farmId: FARM_ID,
  denomination: 'Fazenda Limeira',
  cib: '123.456.789-0',
  incraCode: null,
  ccirCode: null,
  ccirValidUntil: null,
  carCode: null,
  totalAreaHa: 100,
  landClassification: null,
  productive: null,
  municipality: 'Araraquara',
  state: 'SP',
  boundaryAreaHa: null,
  titlesCount: 0,
  ownersCount: 0,
  documentsCount: 0,
  createdAt: new Date().toISOString(),
};

const SAMPLE_DETAIL = {
  ...SAMPLE_PROPERTY,
  ccirIssuedAt: null,
  ccirGeneratedAt: null,
  ccirPaymentStatus: null,
  registeredAreaHa: null,
  possessionByTitleHa: null,
  possessionByOccupationHa: null,
  measuredAreaHa: null,
  certifiedAreaHa: null,
  locationDirections: null,
  lastProcessingDate: null,
  fiscalModuleHa: null,
  fiscalModulesCount: null,
  ruralModuleHa: null,
  ruralModulesCount: null,
  minPartitionFraction: null,
  vtnPerHa: null,
  appAreaHa: null,
  legalReserveHa: null,
  taxableAreaHa: null,
  usableAreaHa: null,
  utilizationDegree: null,
  owners: [],
  titles: [],
};

const SAMPLE_OWNER = {
  id: OWNER_ID,
  name: 'Lucas Silva',
  document: '123.456.789-00',
  documentType: 'CPF',
  fractionPct: 50,
  ownerType: 'PROPRIETARIO',
};

describe('Rural Properties endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Properties CRUD ──────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/properties', () => {
    it('should return 201 with created property', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createRuralProperty.mockResolvedValue(SAMPLE_PROPERTY);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties`)
        .set('Authorization', 'Bearer token')
        .send({ denomination: 'Fazenda Limeira', state: 'SP', totalAreaHa: 100 });

      expect(res.status).toBe(201);
      expect(res.body.denomination).toBe('Fazenda Limeira');
      expect(mockedService.createRuralProperty).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        expect.objectContaining({ denomination: 'Fazenda Limeira' }),
      );
    });

    it('should log audit on creation', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createRuralProperty.mockResolvedValue(SAMPLE_PROPERTY);

      await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties`)
        .set('Authorization', 'Bearer token')
        .send({ denomination: 'Fazenda Limeira' });

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_RURAL_PROPERTY',
          targetType: 'rural_property',
          targetId: PROPERTY_ID,
        }),
      );
    });

    it('should return error from service', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createRuralProperty.mockRejectedValue(
        new RuralPropertyError('Denominação é obrigatória', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties`)
        .set('Authorization', 'Bearer token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Denominação é obrigatória');
    });

    it('should return 403 for OPERATOR (no farms:update)', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties`)
        .set('Authorization', 'Bearer token')
        .send({ denomination: 'Test' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/org/farms/:farmId/properties', () => {
    it('should return 200 with list of properties', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listRuralProperties.mockResolvedValue([SAMPLE_PROPERTY]);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/properties`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].denomination).toBe('Fazenda Limeira');
    });
  });

  describe('GET /api/org/farms/:farmId/properties/:propertyId', () => {
    it('should return 200 with property detail', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getRuralProperty.mockResolvedValue(SAMPLE_DETAIL);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.denomination).toBe('Fazenda Limeira');
      expect(res.body.owners).toEqual([]);
      expect(res.body.titles).toEqual([]);
    });

    it('should return 404 when not found', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getRuralProperty.mockRejectedValue(
        new RuralPropertyError('Imóvel rural não encontrado', 404),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/properties/nonexistent`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/org/farms/:farmId/properties/:propertyId', () => {
    it('should return 200 with updated property', async () => {
      authAs(ADMIN_PAYLOAD);
      const updated = { ...SAMPLE_DETAIL, denomination: 'Fazenda Nova' };
      mockedService.updateRuralProperty.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}`)
        .set('Authorization', 'Bearer token')
        .send({ denomination: 'Fazenda Nova' });

      expect(res.status).toBe(200);
      expect(res.body.denomination).toBe('Fazenda Nova');
    });

    it('should log audit on update', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.updateRuralProperty.mockResolvedValue(SAMPLE_DETAIL);

      await request(app)
        .patch(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}`)
        .set('Authorization', 'Bearer token')
        .send({ denomination: 'Fazenda Nova' });

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_RURAL_PROPERTY',
          targetId: PROPERTY_ID,
        }),
      );
    });
  });

  describe('DELETE /api/org/farms/:farmId/properties/:propertyId', () => {
    it('should return 204 on successful delete', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteRuralProperty.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
    });

    it('should log audit on delete', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteRuralProperty.mockResolvedValue(undefined);

      await request(app)
        .delete(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}`)
        .set('Authorization', 'Bearer token');

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_RURAL_PROPERTY',
          targetId: PROPERTY_ID,
        }),
      );
    });
  });

  // ─── Owners ───────────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/properties/:propertyId/owners', () => {
    it('should return 201 with created owner', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.addOwner.mockResolvedValue(SAMPLE_OWNER);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/owners`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'Lucas Silva', document: '123.456.789-00', fractionPct: 50 });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Lucas Silva');
    });

    it('should log audit on owner creation', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.addOwner.mockResolvedValue(SAMPLE_OWNER);

      await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/owners`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'Lucas Silva' });

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADD_PROPERTY_OWNER',
          targetType: 'property_owner',
        }),
      );
    });
  });

  describe('PATCH /api/org/farms/:farmId/properties/:propertyId/owners/:ownerId', () => {
    it('should return 200 with updated owner', async () => {
      authAs(ADMIN_PAYLOAD);
      const updated = { ...SAMPLE_OWNER, fractionPct: 75 };
      mockedService.updateOwner.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/owners/${OWNER_ID}`)
        .set('Authorization', 'Bearer token')
        .send({ fractionPct: 75 });

      expect(res.status).toBe(200);
      expect(res.body.fractionPct).toBe(75);
    });
  });

  describe('DELETE /api/org/farms/:farmId/properties/:propertyId/owners/:ownerId', () => {
    it('should return 204 on successful delete', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteOwner.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/owners/${OWNER_ID}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
    });
  });

  // ─── Documents ────────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/properties/:propertyId/documents', () => {
    it('should return 201 with uploaded document metadata', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.uploadDocument.mockResolvedValue({
        id: DOC_ID,
        type: 'CCIR',
        filename: 'ccir.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        extractionStatus: 'PENDING',
        extractedData: null,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'admin-1',
      });

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents`)
        .set('Authorization', 'Bearer token')
        .field('type', 'CCIR')
        .attach('file', Buffer.from('fake-pdf'), {
          filename: 'ccir.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('CCIR');
      expect(res.body.extractionStatus).toBe('PENDING');
    });

    it('should return 400 without file', async () => {
      authAs(ADMIN_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents`)
        .set('Authorization', 'Bearer token')
        .field('type', 'CCIR');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Arquivo é obrigatório');
    });

    it('should return 400 with invalid document type', async () => {
      authAs(ADMIN_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents`)
        .set('Authorization', 'Bearer token')
        .field('type', 'INVALID')
        .attach('file', Buffer.from('fake'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Tipo de documento inválido');
    });

    it('should return 400 with unsupported mime type', async () => {
      authAs(ADMIN_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents`)
        .set('Authorization', 'Bearer token')
        .field('type', 'CCIR')
        .attach('file', Buffer.from('fake'), { filename: 'test.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Formato de arquivo não suportado');
    });

    it('should log audit on document upload', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.uploadDocument.mockResolvedValue({
        id: DOC_ID,
        type: 'CAFIR',
        filename: 'cafir.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        extractionStatus: 'PENDING',
        extractedData: null,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'admin-1',
      });

      await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents`)
        .set('Authorization', 'Bearer token')
        .field('type', 'CAFIR')
        .attach('file', Buffer.from('fake-pdf'), {
          filename: 'cafir.pdf',
          contentType: 'application/pdf',
        });

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPLOAD_PROPERTY_DOCUMENT',
          targetType: 'property_document',
        }),
      );
    });
  });

  describe('GET /api/org/farms/:farmId/properties/:propertyId/documents', () => {
    it('should return 200 with list of documents', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listDocuments.mockResolvedValue([
        {
          id: DOC_ID,
          type: 'CCIR',
          filename: 'ccir.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          extractionStatus: 'PENDING',
          extractedData: null,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'admin-1',
        },
      ]);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].type).toBe('CCIR');
    });
  });

  describe('GET /api/org/farms/:farmId/properties/:propertyId/documents/:docId', () => {
    it('should return file data with correct headers', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getDocument.mockResolvedValue({
        filename: 'ccir.pdf',
        mimeType: 'application/pdf',
        fileData: Buffer.from('fake-pdf-content'),
      });

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('ccir.pdf');
    });

    it('should return 404 when document not found', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getDocument.mockRejectedValue(
        new RuralPropertyError('Documento não encontrado', 404),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents/nonexistent`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/org/farms/:farmId/properties/:propertyId/documents/:docId', () => {
    it('should return 204 on successful delete', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteDocument.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
    });

    it('should log audit on document delete', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteDocument.mockResolvedValue(undefined);

      await request(app)
        .delete(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer token');

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_PROPERTY_DOCUMENT',
          targetId: DOC_ID,
        }),
      );
    });
  });

  // ─── RBAC ─────────────────────────────────────────────────────────

  describe('RBAC', () => {
    it('OPERATOR should not have farms:update permission for creating properties', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties`)
        .set('Authorization', 'Bearer token')
        .send({ denomination: 'Test' });

      expect(res.status).toBe(403);
    });

    it('OPERATOR should not be able to add owners', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/owners`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test' });

      expect(res.status).toBe(403);
    });

    it('OPERATOR should not be able to upload documents', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/properties/${PROPERTY_ID}/documents`)
        .set('Authorization', 'Bearer token')
        .field('type', 'CCIR')
        .attach('file', Buffer.from('fake'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(403);
    });
  });
});
