import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { MilkTankError } from './milk-tanks.types';
import {
  createTank,
  listTanks,
  getTank,
  updateTank,
  deleteTank,
  recordMeasurement,
  listMeasurements,
  createCollection,
  listCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  uploadCollectionTicket,
  getReconciliation,
  getMonthlyReport,
  exportCollectionsCsv,
} from './milk-tanks.service';

export const milkTanksRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MilkTankError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MilkTankError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('MilkTank error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ═══════════════════════════════════════════════════════════════════
// TANK CRUD (CA1)
// ═══════════════════════════════════════════════════════════════════

// ─── LIST TANKS ────────────────────────────────────────────────────

milkTanksRouter.get(
  '/org/farms/:farmId/milk-tanks',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listTanks(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE TANK ───────────────────────────────────────────────────

milkTanksRouter.post(
  '/org/farms/:farmId/milk-tanks',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createTank(ctx, req.params.farmId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_COOLING_TANK',
        targetType: 'cooling_tank',
        targetId: result.id,
        metadata: {
          name: result.name,
          capacityLiters: result.capacityLiters,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET TANK ──────────────────────────────────────────────────────

milkTanksRouter.get(
  '/org/farms/:farmId/milk-tanks/:tankId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getTank(ctx, req.params.farmId as string, req.params.tankId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE TANK ───────────────────────────────────────────────────

milkTanksRouter.patch(
  '/org/farms/:farmId/milk-tanks/:tankId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateTank(
        ctx,
        req.params.farmId as string,
        req.params.tankId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_COOLING_TANK',
        targetType: 'cooling_tank',
        targetId: result.id,
        metadata: {
          changes: Object.keys(req.body),
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE TANK ───────────────────────────────────────────────────

milkTanksRouter.delete(
  '/org/farms/:farmId/milk-tanks/:tankId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteTank(ctx, req.params.farmId as string, req.params.tankId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_COOLING_TANK',
        targetType: 'cooling_tank',
        targetId: req.params.tankId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Tanque desativado com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// TANK MEASUREMENTS (CA2)
// ═══════════════════════════════════════════════════════════════════

// ─── LIST MEASUREMENTS ─────────────────────────────────────────────

milkTanksRouter.get(
  '/org/farms/:farmId/milk-tanks/:tankId/measurements',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listMeasurements(
        ctx,
        req.params.farmId as string,
        req.params.tankId as string,
        query,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RECORD MEASUREMENT ────────────────────────────────────────────

milkTanksRouter.post(
  '/org/farms/:farmId/milk-tanks/:tankId/measurements',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recordMeasurement(
        ctx,
        req.params.farmId as string,
        req.params.tankId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_TANK_MEASUREMENT',
        targetType: 'tank_measurement',
        targetId: result.id,
        metadata: {
          tankId: req.params.tankId as string,
          measureDate: result.measureDate,
          volumeLiters: result.volumeLiters,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// MILK COLLECTIONS (CA3)
// ═══════════════════════════════════════════════════════════════════

// ─── RECONCILIATION (CA5/CA7) ──────────────────────────────────────

milkTanksRouter.get(
  '/org/farms/:farmId/milk-collections/reconciliation',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getReconciliation(
        ctx,
        req.params.farmId as string,
        req.query.dateFrom as string,
        req.query.dateTo as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── MONTHLY REPORT (CA6) ──────────────────────────────────────────

milkTanksRouter.get(
  '/org/farms/:farmId/milk-collections/monthly-report',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getMonthlyReport(
        ctx,
        req.params.farmId as string,
        req.query.month as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT CSV ────────────────────────────────────────────────────

milkTanksRouter.get(
  '/org/farms/:farmId/milk-collections/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        dairyCompany: req.query.dairyCompany as string | undefined,
      };

      const csv = await exportCollectionsCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="coletas-leite-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST COLLECTIONS ──────────────────────────────────────────────

milkTanksRouter.get(
  '/org/farms/:farmId/milk-collections',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        dairyCompany: req.query.dairyCompany as string | undefined,
        divergenceAlert: req.query.divergenceAlert === 'true' ? true : undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listCollections(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE COLLECTION ─────────────────────────────────────────────

milkTanksRouter.post(
  '/org/farms/:farmId/milk-collections',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createCollection(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_MILK_COLLECTION',
        targetType: 'milk_collection',
        targetId: result.id,
        metadata: {
          collectionDate: result.collectionDate,
          dairyCompany: result.dairyCompany,
          volumeLiters: result.volumeLiters,
          divergenceAlert: result.divergenceAlert,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET COLLECTION ────────────────────────────────────────────────

milkTanksRouter.get(
  '/org/farms/:farmId/milk-collections/:collectionId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCollection(
        ctx,
        req.params.farmId as string,
        req.params.collectionId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE COLLECTION ─────────────────────────────────────────────

milkTanksRouter.patch(
  '/org/farms/:farmId/milk-collections/:collectionId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateCollection(
        ctx,
        req.params.farmId as string,
        req.params.collectionId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MILK_COLLECTION',
        targetType: 'milk_collection',
        targetId: result.id,
        metadata: {
          changes: Object.keys(req.body),
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE COLLECTION ─────────────────────────────────────────────

milkTanksRouter.delete(
  '/org/farms/:farmId/milk-collections/:collectionId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCollection(ctx, req.params.farmId as string, req.params.collectionId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_MILK_COLLECTION',
        targetType: 'milk_collection',
        targetId: req.params.collectionId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Coleta excluída com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// TICKET UPLOAD (CA4)
// ═══════════════════════════════════════════════════════════════════

const ACCEPTED_TICKET_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const MAX_TICKET_SIZE = 10 * 1024 * 1024; // 10 MB

const ticketUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_TICKET_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ACCEPTED_TICKET_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não aceito. Use JPG, PNG ou PDF.'));
    }
  },
});

milkTanksRouter.post(
  '/org/farms/:farmId/milk-collections/:collectionId/ticket',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  (req, res) => {
    ticketUpload.single('file')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        if (uploadErr instanceof multer.MulterError) {
          res.status(400).json({
            error:
              uploadErr.code === 'LIMIT_FILE_SIZE'
                ? 'Arquivo excede o limite de 10 MB'
                : uploadErr.message,
          });
        } else if (uploadErr instanceof Error) {
          res.status(400).json({ error: uploadErr.message });
        } else {
          res.status(400).json({ error: 'Erro no upload do arquivo' });
        }
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Nenhum arquivo enviado' });
        return;
      }

      try {
        const ctx = buildRlsContext(req);
        const result = await uploadCollectionTicket(
          ctx,
          req.params.farmId as string,
          req.params.collectionId as string,
          req.file,
        );

        void logAudit({
          actorId: req.user!.userId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'UPLOAD_COLLECTION_TICKET',
          targetType: 'milk_collection',
          targetId: req.params.collectionId as string,
          metadata: {
            fileName: req.file.originalname,
            farmId: req.params.farmId as string,
          },
          ipAddress: getClientIp(req),
          farmId: req.params.farmId as string,
          organizationId: ctx.organizationId,
        });

        res.json(result);
      } catch (err) {
        handleError(err, res);
      }
    });
  },
);
