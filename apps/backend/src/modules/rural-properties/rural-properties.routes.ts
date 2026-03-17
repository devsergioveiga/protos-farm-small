import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import {
  listAllRuralProperties,
  createRuralProperty,
  listRuralProperties,
  getRuralProperty,
  updateRuralProperty,
  deleteRuralProperty,
  addOwner,
  updateOwner,
  deleteOwner,
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  uploadRuralPropertyBoundary,
  getRuralPropertyBoundary,
  deleteRuralPropertyBoundary,
} from './rural-properties.service';
import {
  RuralPropertyError,
  MAX_DOCUMENT_SIZE,
  ALLOWED_DOCUMENT_MIMES,
  DOCUMENT_TYPES,
} from './rural-properties.types';
import { ALLOWED_GEO_EXTENSIONS, MAX_GEO_FILE_SIZE } from '../farms/farms.types';
import path from 'node:path';

export const ruralPropertiesRouter = Router();

const upload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE },
});

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new RuralPropertyError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof RuralPropertyError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('[rural-properties] Internal error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── List all (org-wide) ────────────────────────────────────────────

// GET /org/rural-properties
ruralPropertiesRouter.get(
  '/org/rural-properties',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listAllRuralProperties(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Parse CCIR (extract data without saving) ──────────────────────

// POST /org/rural-properties/parse-ccir
ruralPropertiesRouter.post(
  '/org/rural-properties/parse-ccir',
  authenticate,
  checkPermission('farms:read'),
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Arquivo é obrigatório' });
        return;
      }

      if (file.mimetype !== 'application/pdf') {
        res.status(400).json({ error: 'Somente arquivos PDF são aceitos para extração' });
        return;
      }

      const { extractFromDocument } = await import('./document-parsers/extract');
      const result = await extractFromDocument('CCIR', file.buffer, file.mimetype);

      if (result.status === 'FAILED') {
        res
          .status(422)
          .json({ error: 'Não foi possível extrair dados do CCIR', details: result.data });
        return;
      }

      res.json({ extracted: result.data });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Properties CRUD ────────────────────────────────────────────────

// POST /org/farms/:farmId/properties
ruralPropertiesRouter.post(
  '/org/farms/:farmId/properties',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const farmId = req.params.farmId as string;
      const ctx = buildRlsContext(req);
      const result = await createRuralProperty(ctx, farmId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_RURAL_PROPERTY',
        targetType: 'rural_property',
        targetId: result.id,
        metadata: { denomination: req.body.denomination, farmId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/farms/:farmId/properties
ruralPropertiesRouter.get(
  '/org/farms/:farmId/properties',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listRuralProperties(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/farms/:farmId/properties/:propertyId
ruralPropertiesRouter.get(
  '/org/farms/:farmId/properties/:propertyId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getRuralProperty(
        ctx,
        req.params.farmId as string,
        req.params.propertyId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/farms/:farmId/properties/:propertyId
ruralPropertiesRouter.patch(
  '/org/farms/:farmId/properties/:propertyId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const farmId = req.params.farmId as string;
      const propertyId = req.params.propertyId as string;
      const ctx = buildRlsContext(req);
      const result = await updateRuralProperty(ctx, farmId, propertyId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_RURAL_PROPERTY',
        targetType: 'rural_property',
        targetId: propertyId,
        metadata: { changes: Object.keys(req.body) },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/farms/:farmId/properties/:propertyId
ruralPropertiesRouter.delete(
  '/org/farms/:farmId/properties/:propertyId',
  authenticate,
  checkPermission('farms:delete'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const farmId = req.params.farmId as string;
      const propertyId = req.params.propertyId as string;
      const ctx = buildRlsContext(req);
      await deleteRuralProperty(ctx, farmId, propertyId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_RURAL_PROPERTY',
        targetType: 'rural_property',
        targetId: propertyId,
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId,
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Owners ─────────────────────────────────────────────────────────

// POST /org/farms/:farmId/properties/:propertyId/owners
ruralPropertiesRouter.post(
  '/org/farms/:farmId/properties/:propertyId/owners',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const farmId = req.params.farmId as string;
      const propertyId = req.params.propertyId as string;
      const ctx = buildRlsContext(req);
      const result = await addOwner(ctx, farmId, propertyId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ADD_PROPERTY_OWNER',
        targetType: 'property_owner',
        targetId: result.id,
        metadata: { name: req.body.name, propertyId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/farms/:farmId/properties/:propertyId/owners/:ownerId
ruralPropertiesRouter.patch(
  '/org/farms/:farmId/properties/:propertyId/owners/:ownerId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateOwner(
        ctx,
        req.params.farmId as string,
        req.params.propertyId as string,
        req.params.ownerId as string,
        req.body,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/farms/:farmId/properties/:propertyId/owners/:ownerId
ruralPropertiesRouter.delete(
  '/org/farms/:farmId/properties/:propertyId/owners/:ownerId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteOwner(
        ctx,
        req.params.farmId as string,
        req.params.propertyId as string,
        req.params.ownerId as string,
      );
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Documents ──────────────────────────────────────────────────────

// POST /org/farms/:farmId/properties/:propertyId/documents
ruralPropertiesRouter.post(
  '/org/farms/:farmId/properties/:propertyId/documents',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo é obrigatório' });
        return;
      }

      const docType = req.body.type;
      if (!docType || !(DOCUMENT_TYPES as readonly string[]).includes(docType)) {
        res
          .status(400)
          .json({
            error: `Tipo de documento inválido. Valores permitidos: ${DOCUMENT_TYPES.join(', ')}`,
          });
        return;
      }

      if (!ALLOWED_DOCUMENT_MIMES.includes(req.file.mimetype as string)) {
        res
          .status(400)
          .json({ error: 'Formato de arquivo não suportado. Aceitos: PDF, JPEG, PNG' });
        return;
      }

      const farmId = req.params.farmId as string;
      const propertyId = req.params.propertyId as string;
      const ctx = buildRlsContext(req);
      const result = await uploadDocument(
        ctx,
        farmId,
        propertyId,
        {
          type: docType,
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          fileData: req.file.buffer,
        },
        req.user!.userId,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPLOAD_PROPERTY_DOCUMENT',
        targetType: 'property_document',
        targetId: result.id,
        metadata: { type: docType, filename: req.file.originalname, propertyId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/farms/:farmId/properties/:propertyId/documents
ruralPropertiesRouter.get(
  '/org/farms/:farmId/properties/:propertyId/documents',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listDocuments(
        ctx,
        req.params.farmId as string,
        req.params.propertyId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/farms/:farmId/properties/:propertyId/documents/:docId
ruralPropertiesRouter.get(
  '/org/farms/:farmId/properties/:propertyId/documents/:docId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const doc = await getDocument(
        ctx,
        req.params.farmId as string,
        req.params.propertyId as string,
        req.params.docId as string,
      );

      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
      res.send(doc.fileData);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/farms/:farmId/properties/:propertyId/documents/:docId
ruralPropertiesRouter.delete(
  '/org/farms/:farmId/properties/:propertyId/documents/:docId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const farmId = req.params.farmId as string;
      const propertyId = req.params.propertyId as string;
      const docId = req.params.docId as string;
      const ctx = buildRlsContext(req);
      await deleteDocument(ctx, farmId, propertyId, docId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PROPERTY_DOCUMENT',
        targetType: 'property_document',
        targetId: docId,
        metadata: { propertyId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId,
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Boundary Endpoints ─────────────────────────────────────────────

const geoUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_GEO_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ((ALLOWED_GEO_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Formato não suportado. Extensões aceitas: ${ALLOWED_GEO_EXTENSIONS.join(', ')}`),
      );
    }
  },
});

function handleGeoUpload(
  req: import('express').Request,
  res: import('express').Response,
): Promise<void> {
  return new Promise((resolve) => {
    geoUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          res.status(400).json({
            error:
              err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo excede o limite de 10 MB' : err.message,
          });
        } else if (err instanceof Error) {
          res.status(400).json({ error: err.message });
        }
        resolve();
      } else {
        resolve();
      }
    });
  });
}

// POST /org/farms/:farmId/properties/:propertyId/boundary
ruralPropertiesRouter.post(
  '/org/farms/:farmId/properties/:propertyId/boundary',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    await handleGeoUpload(req, res);
    if (res.headersSent) return;
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo é obrigatório' });
        return;
      }

      const ctx = buildRlsContext(req);
      const result = await uploadRuralPropertyBoundary(
        ctx,
        req.params.farmId as string,
        req.params.propertyId as string,
        req.file.buffer,
        req.file.originalname,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPLOAD_PROPERTY_BOUNDARY',
        targetType: 'rural_property',
        targetId: req.params.propertyId as string,
        metadata: {
          filename: req.file.originalname,
          boundaryAreaHa: result.boundaryAreaHa,
          polygonCount: result.polygonCount,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/farms/:farmId/properties/:propertyId/boundary
ruralPropertiesRouter.get(
  '/org/farms/:farmId/properties/:propertyId/boundary',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getRuralPropertyBoundary(
        ctx,
        req.params.farmId as string,
        req.params.propertyId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/farms/:farmId/properties/:propertyId/boundary
ruralPropertiesRouter.delete(
  '/org/farms/:farmId/properties/:propertyId/boundary',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteRuralPropertyBoundary(
        ctx,
        req.params.farmId as string,
        req.params.propertyId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PROPERTY_BOUNDARY',
        targetType: 'rural_property',
        targetId: req.params.propertyId as string,
        metadata: {},
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
